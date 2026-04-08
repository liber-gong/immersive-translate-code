import * as vscode from 'vscode'
import { getConfig } from './config'
import { createTranslator } from './translator/factory'
import { parseNumberedResult } from './translator/parse'
import { TranslationCache, CacheStorage } from './cache'
import { TranslationOrchestrator, OrchestratorDeps } from './orchestrator'
import { DecorationManager } from './decorator'

interface FileState {
  orchestrator: TranslationOrchestrator;
}

const fileStates = new Map<string, FileState>()
let cache: TranslationCache
let decorationManager: DecorationManager
let scrollListener: vscode.Disposable | undefined
let scrollDebounce: NodeJS.Timeout | undefined

function createVSCodeCacheStorage(context: vscode.ExtensionContext): CacheStorage {
  const KEY = 'translationCache'
  return {
    get: () => context.globalState.get<Record<string, string>>(KEY),
    set: (data) => { context.globalState.update(KEY, data) },
  }
}

function buildDeps(editor: vscode.TextEditor): OrchestratorDeps {
  const config = getConfig()
  const { provider, sourceLanguage: src, targetLanguage: tgt } = config
  const translator = createTranslator(config)
  const uri = editor.document.uri.toString()

  return {
    getLineText: (ln) => editor.document.lineAt(ln).text,
    getLineCount: () => editor.document.lineCount,
    translateBatch: async (texts) => {
      if (translator.translateBatch && texts.length > 1) {
        const merged = texts.map((t, i) => `[${i}] ${t}`).join('\n')
        try {
          const result = await translator.translateBatch(merged, src, tgt)
          console.log(`[ext] LLM batch response:\n${result.text}`)
          const parsed = parseNumberedResult(result.text, texts.length)
          console.log(`[ext] parse result: ${parsed ? 'OK' : 'FAILED'} (expected ${texts.length} lines)`)
          if (parsed) return parsed
        } catch (err) { console.log(`[ext] batch call failed:`, err) }
        console.log(`[ext] falling back to line-by-line`)
      }
      return Promise.all(texts.map(t =>
        translator.translate(t, src, tgt).then(r => r.text).catch(() => ''),
      ))
    },
    onUpdate: (decorations, loading) => {
      const activeEditor = vscode.window.activeTextEditor
      if (activeEditor && activeEditor.document.uri.toString() === uri) {
        decorationManager.apply(activeEditor, decorations, loading)
      }
    },
    cache,
    provider,
    sourceLanguage: src,
    targetLanguage: tgt,
  }
}

async function translateAndPersist(orch: TranslationOrchestrator, start: number, end: number): Promise<void> {
  const sizeBefore = cache.size
  await orch.translateRange(start, end)
  if (cache.size > sizeBefore) { cache.persist() }
}

function getViewportRange(editor: vscode.TextEditor): { start: number; end: number } | null {
  const visible = editor.visibleRanges[0]
  if (!visible) { return null }
  const size = visible.end.line - visible.start.line + 1
  return {
    start: visible.start.line,
    end: Math.min(visible.end.line + size, editor.document.lineCount),
  }
}

async function startImmersive(editor: vscode.TextEditor): Promise<void> {
  const uri = editor.document.uri.toString()

  // Reset existing state
  const existing = fileStates.get(uri)
  if (existing) {
    existing.orchestrator.reset()
    decorationManager.clear(editor)
  }

  const deps = buildDeps(editor)
  const orch = new TranslationOrchestrator(deps)
  fileStates.set(uri, { orchestrator: orch })

  // Set up scroll listener (shared across files)
  if (!scrollListener) {
    scrollListener = vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      const eUri = e.textEditor.document.uri.toString()
      const state = fileStates.get(eUri)
      if (!state) { return }

      if (scrollDebounce) { clearTimeout(scrollDebounce) }
      scrollDebounce = setTimeout(async () => {
        scrollDebounce = undefined
        const range = getViewportRange(e.textEditor)
        if (!range) { return }

        await translateAndPersist(state.orchestrator, range.start, range.end)
      }, 500)
    })
  }

  // Translate initial viewport
  const range = getViewportRange(editor)
  if (!range) { return }

  await translateAndPersist(orch, range.start, range.end)
}

function stopImmersive(editor: vscode.TextEditor): void {
  const uri = editor.document.uri.toString()
  const state = fileStates.get(uri)
  if (state) {
    state.orchestrator.reset()
    fileStates.delete(uri)
  }
  decorationManager.clear(editor)

  // Clean up scroll listener if no files left
  if (fileStates.size === 0) {
    if (scrollDebounce) { clearTimeout(scrollDebounce); scrollDebounce = undefined }
    scrollListener?.dispose()
    scrollListener = undefined
  }
}

export function activate(context: vscode.ExtensionContext) {
  cache = new TranslationCache(createVSCodeCacheStorage(context))
  decorationManager = new DecorationManager()

  const toggleCmd = vscode.commands.registerCommand(
    'immersive-translate-code.toggle',
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.')
        return
      }
      if (fileStates.has(editor.document.uri.toString())) {
        stopImmersive(editor)
      } else {
        await startImmersive(editor)
      }
    },
  )

  const resetCmd = vscode.commands.registerCommand(
    'immersive-translate-code.reset',
    () => {
      // Stop all active translations first
      for (const [uri, state] of fileStates) {
        state.orchestrator.reset()
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri)
        if (editor) { decorationManager.clear(editor) }
      }
      fileStates.clear()
      if (scrollDebounce) { clearTimeout(scrollDebounce); scrollDebounce = undefined }
      scrollListener?.dispose()
      scrollListener = undefined

      const count = cache.size
      cache.clear()
      vscode.window.showInformationMessage(`Translation cache cleared (${count} entries).`)
    },
  )

  // Re-apply decorations when switching tabs
  const tabChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) { return }
    const state = fileStates.get(editor.document.uri.toString())
    if (state) {
      state.orchestrator.reapply()
    }
  })

  context.subscriptions.push(toggleCmd, resetCmd, tabChangeListener, decorationManager)
}

export function deactivate() {
  scrollListener?.dispose()
  for (const state of fileStates.values()) {
    state.orchestrator.reset()
  }
  fileStates.clear()
}

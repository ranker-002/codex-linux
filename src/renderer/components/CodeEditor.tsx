import React, { useRef, useCallback } from 'react';
import Editor, { Monaco, OnMount, DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { 
  Copy, 
  Download, 
  Settings,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/Button';

interface CodeEditorProps {
  value: string;
  language?: string;
  theme?: 'vs-dark' | 'vs-light' | 'hc-black';
  readOnly?: boolean;
  onChange?: (value: string | undefined) => void;
  onSave?: (value: string) => void;
  showLineNumbers?: boolean;
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  fontSize?: number;
  minimap?: boolean;
  lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
  originalValue?: string;
  diffEditor?: boolean;
  height?: string;
  dataTestid?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language = 'javascript',
  theme,
  readOnly = false,
  onChange,
  onSave,
  showLineNumbers = true,
  wordWrap = 'on',
  fontSize = 14,
  minimap = true,
  lineNumbers = 'on',
  originalValue,
  diffEditor = false,
  height = '100%',
  dataTestid = 'code-editor'
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const effectiveTheme =
    theme ?? (document.documentElement.getAttribute('data-theme') === 'light' ? 'vs-light' : 'vs-dark');

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions = [
          { label: 'console.log', kind: monaco.languages.CompletionItemKind.Function, insertText: 'console.log(${1:message})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
          { label: 'const', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'const ${1:name} = ${2:value}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
          { label: 'function', kind: monaco.languages.CompletionItemKind.Function, insertText: 'function ${1:name}(${2:params}) {\n\t${3:// body}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
          { label: 'async', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'async function ${1:name}(${2:params}) {\n\t${3:// body}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
          { label: 'class', kind: monaco.languages.CompletionItemKind.Class, insertText: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t${3:// init}\n\t}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
          { label: 'interface', kind: monaco.languages.CompletionItemKind.Interface, insertText: 'interface ${1:Name} {\n\t${2:property}: ${3:type}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
          { label: 'import', kind: monaco.languages.CompletionItemKind.Module, insertText: "import { ${1:module} } from '${2:path}'", insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
          { label: 'export', kind: monaco.languages.CompletionItemKind.Module, insertText: 'export ${1:default} ${2:statement}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
        ];

        return { suggestions };
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave && editor.getValue()) {
        onSave(editor.getValue());
      }
    });

    editor.focus();
  }, [language, onSave]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
  }, [value]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language === 'python' ? 'py' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [value, language]);

  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  if (diffEditor && originalValue !== undefined) {
    return (
      <div className="flex flex-col h-full border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden" data-testid={dataTestid}>
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span>Diff Editor</span>
            <span className="px-2 py-0.5 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded text-xs text-[var(--text-secondary)]">
              {language}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1">
          <DiffEditor
            height="100%"
            language={language}
            theme={effectiveTheme}
            original={originalValue}
            modified={value}
            options={{
              readOnly,
              renderSideBySide: true,
              fontSize,
              minimap: { enabled: minimap },
              lineNumbers: 'on',
              wordWrap,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden" data-testid={dataTestid}>
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>{language === 'typescript' ? 'TypeScript' : language === 'javascript' ? 'JavaScript' : language}</span>
          <span className="px-2 py-0.5 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded text-xs text-[var(--text-secondary)]">
            {value.split('\n').length} lines
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleFormat}
            title="Format code"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDownload}
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1" style={{ height }}>
        <Editor
          height="100%"
          language={language}
          value={value}
          theme={effectiveTheme}
          onChange={onChange}
          onMount={handleEditorMount}
          options={{
            readOnly,
            fontSize,
            minimap: { enabled: minimap },
            lineNumbers: showLineNumbers ? lineNumbers : 'off',
            wordWrap,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'always',
            bracketPairColorization: { enabled: true },
            padding: { top: 8, bottom: 8 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            renderWhitespace: 'selection',
            guides: {
              bracketPairs: true,
              indentation: true,
            },
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
            </div>
          }
        />
      </div>
    </div>
  );
};

export default CodeEditor;

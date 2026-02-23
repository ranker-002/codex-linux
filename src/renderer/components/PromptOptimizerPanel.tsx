import React, { useState, useEffect, useCallback } from 'react';

interface PromptAnalysis {
  originalPrompt: string;
  optimizedPrompt: string;
  improvements: Array<{
    type: string;
    description: string;
    before: string;
    after: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  metrics: {
    clarity: number;
    specificity: number;
    context: number;
    structure: number;
    overall: number;
  };
  estimatedTokens: number;
  suggestions: string[];
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: string[];
}

interface PromptOptimizerPanelProps {
  onAnalyze?: (prompt: string) => Promise<PromptAnalysis>;
  onOptimize?: (prompt: string, options?: any) => Promise<PromptAnalysis>;
  onTest?: (prompt: string, input?: string) => Promise<any>;
  templates?: PromptTemplate[];
  onGenerateFromTemplate?: (templateId: string, variables: Record<string, string>) => Promise<string>;
}

export const PromptOptimizerPanel: React.FC<PromptOptimizerPanelProps> = ({
  onAnalyze,
  onOptimize,
  onTest,
  templates = [],
  onGenerateFromTemplate,
}) => {
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'analyzer' | 'templates' | 'testing'>('analyzer');

  const categories = [...new Set(templates.map(t => t.category))];

  const handleAnalyze = useCallback(async () => {
    if (!prompt || !onAnalyze) return;
    
    setIsAnalyzing(true);
    try {
      const result = await onAnalyze(prompt);
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [prompt, onAnalyze]);

  const handleOptimize = useCallback(async () => {
    if (!prompt || !onOptimize) return;
    
    setIsOptimizing(true);
    try {
      const result = await onOptimize(prompt, {
        style: 'detailed',
        addExamples: true,
        addConstraints: true,
        improveStructure: true,
      });
      setAnalysis(result);
      setShowOptimized(true);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  }, [prompt, onOptimize]);

  const handleUseOptimized = useCallback(() => {
    if (analysis?.optimizedPrompt) {
      setPrompt(analysis.optimizedPrompt);
      setShowOptimized(false);
    }
  }, [analysis]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const vars: Record<string, string> = {};
      template.variables.forEach(v => vars[v] = '');
      setTemplateVars(vars);
    }
  }, [templates]);

  const handleGenerateFromTemplate = useCallback(async () => {
    if (!selectedTemplate || !onGenerateFromTemplate) return;
    
    try {
      const generatedPrompt = await onGenerateFromTemplate(selectedTemplate, templateVars);
      setPrompt(generatedPrompt);
      setSelectedTemplate('');
    } catch (error) {
      console.error('Template generation failed:', error);
    }
  }, [selectedTemplate, templateVars, onGenerateFromTemplate]);

  const getMetricColor = (value: number): string => {
    if (value >= 80) return 'text-green-400';
    if (value >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">✨ Prompt Optimizer</h2>
        <p className="text-gray-400 text-sm">
          Analyze, optimize, and test your prompts for better AI responses
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['analyzer', 'templates', 'testing'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab === 'analyzer' ? '🔍 Analyzer' : tab === 'templates' ? '📋 Templates' : '🧪 Testing'}
          </button>
        ))}
      </div>

      {/* Analyzer Tab */}
      {activeTab === 'analyzer' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Prompt Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Your Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt to analyze and optimize..."
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-mono text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleAnalyze}
              disabled={!prompt || isAnalyzing}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {isAnalyzing ? '⏳' : '🔍'} Analyze
            </button>
            <button
              onClick={handleOptimize}
              disabled={!prompt || isOptimizing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {isOptimizing ? '⏳' : '⚡'} Optimize
            </button>
          </div>

          {/* Results */}
          {analysis && (
            <div className="flex-1 overflow-y-auto">
              {/* Metrics */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">Quality Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(analysis.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400 capitalize">{key}</span>
                        <span className={`font-medium ${getMetricColor(value)}`}>{value}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm text-gray-400">
                  Estimated tokens: ~{analysis.estimatedTokens}
                </div>
              </div>

              {/* Improvements */}
              {analysis.improvements.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold mb-3">Suggested Improvements</h3>
                  <div className="space-y-3">
                    {analysis.improvements.map((improvement, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${getImpactColor(improvement.impact)}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs uppercase font-medium">{improvement.type}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-black/20">{improvement.impact} impact</span>
                        </div>
                        <p className="text-sm mb-2">{improvement.description}</p>
                        {showOptimized && (
                          <div className="text-xs font-mono bg-black/20 p-2 rounded">
                            <div className="text-red-400 line-through mb-1">{improvement.before.substring(0, 50)}...</div>
                            <div className="text-green-400">{improvement.after.substring(0, 50)}...</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold mb-3">Additional Suggestions</h3>
                  <ul className="space-y-2">
                    {analysis.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-400">•</span>
                        <span className="text-gray-300">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Optimized Prompt */}
              {showOptimized && analysis.optimizedPrompt !== analysis.originalPrompt && (
                <div className="bg-gray-800 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Optimized Prompt</h3>
                    <button
                      onClick={handleUseOptimized}
                      className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
                    >
                      Use This Prompt
                    </button>
                  </div>
                  <pre className="text-sm font-mono bg-black/30 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {analysis.optimizedPrompt}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select a Template</label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Choose a template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.description}
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && (
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const template = templates.find(t => t.id === selectedTemplate);
                if (!template) return null;
                
                return (
                  <>
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                      <h3 className="font-semibold mb-2">{template.name}</h3>
                      <p className="text-sm text-gray-400 mb-3">{template.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {template.variables.map(v => (
                          <span key={v} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Fill Variables</h4>
                      {template.variables.map(variable => (
                        <div key={variable} className="mb-3">
                          <label className="block text-xs text-gray-400 mb-1 capitalize">
                            {variable.replace(/([A-Z])/g, ' $1').trim()}
                          </label>
                          <input
                            type="text"
                            value={templateVars[variable] || ''}
                            onChange={(e) => setTemplateVars(prev => ({ ...prev, [variable]: e.target.value }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder={`Enter ${variable}...`}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleGenerateFromTemplate}
                      disabled={Object.values(templateVars).some(v => !v)}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors"
                    >
                      Generate Prompt
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Testing Tab */}
      {activeTab === 'testing' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Prompt to Test</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the prompt you want to test..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-mono text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Test Input (Optional)</label>
            <textarea
              placeholder="Additional context or test data..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none text-sm"
            />
          </div>

          <button
            onClick={() => onTest?.(prompt)}
            disabled={!prompt}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
          >
            🧪 Run Test
          </button>

          <div className="mt-4 text-center text-gray-500 text-sm">
            Test results will show response quality, relevance, and completeness metrics
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptOptimizerPanel;

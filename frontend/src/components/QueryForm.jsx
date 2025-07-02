import { useState, useRef, useEffect } from 'react';
import { documentAPI } from '../api';

const QueryForm = ({ organizationId, authToken }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sources, setSources] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const answerRef = useRef(null);

  // Auto-scroll to bottom when answer updates
  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [answer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError('');
    setAnswer('');
    setSources([]);
    setIsTyping(true);

    try {
      let fullAnswer = '';
      let finalSources = [];

      await documentAPI.streamingQuery(question, organizationId, authToken, (data) => {
        if (data.answer) {
          fullAnswer += data.answer;
          setAnswer(fullAnswer);
        }
        if (data.sources) {
          finalSources = data.sources;
          setSources(data.sources);
        }
      });

      setIsTyping(false);
    } catch (error) {
      setError(error.message);
      setIsTyping(false);
    } finally {
      setLoading(false);
    }
  };

  const formatAnswer = (text) => {
    // Split into paragraphs and format
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="mb-4 leading-relaxed">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Chat Interface */}
      <div className="flex flex-col h-[600px] bg-github-bg-secondary rounded-lg border border-github-border">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-github-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-github-accent rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-github-text">PaperQA Assistant</h3>
              <p className="text-xs text-github-text-muted">Ask questions about your documents</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={answerRef}
          className="flex-1 overflow-y-auto p-4 space-y-6"
        >
          {answer && (
            <div className="flex space-x-3">
              <div className="w-8 h-8 bg-github-accent rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div className="flex-1">
                <div className="bg-github-bg-tertiary rounded-lg p-4 text-github-text">
                  {formatAnswer(answer)}
                  {isTyping && (
                    <span className="inline-block w-2 h-4 bg-github-primary animate-pulse ml-1"></span>
                  )}
                </div>
                {sources && sources.length > 0 && (
                  <div className="mt-3 text-xs text-github-text-muted">
                    <p className="font-medium mb-2">Sources:</p>
                    <ul className="space-y-1">
                      {sources.map((source, index) => (
                        <li key={index} className="text-github-text-secondary">
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex space-x-3">
              <div className="w-8 h-8 bg-github-danger rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <div className="flex-1">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-300">
                  {error}
                </div>
              </div>
            </div>
          )}

          {loading && !answer && (
            <div className="flex space-x-3">
              <div className="w-8 h-8 bg-github-accent rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div className="flex-1">
                <div className="bg-github-bg-tertiary rounded-lg p-4">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-github-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-github-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-github-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="border-t border-github-border p-4">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <div className="flex-1">
              <textarea 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your documents..."
                className="w-full px-4 py-3 bg-github-bg border border-github-border rounded-lg text-github-text placeholder-github-text-muted resize-none focus:border-github-primary focus:outline-none focus:ring-1 focus:ring-github-primary"
                rows="1"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !question.trim()}
              className="px-4 py-3 bg-github-accent hover:bg-github-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-150 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                  </svg>
                  <span>Send</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QueryForm; 
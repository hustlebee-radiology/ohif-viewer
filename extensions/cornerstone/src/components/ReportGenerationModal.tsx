import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import apiClient from '../../../../platform/app/src/utils/apiClient';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icons,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@ohif/ui-next';

declare global {
  interface Window {
    fetchModality: () => Promise<string | undefined>;
  }
}

interface ReportGenerationModalProps {
  hide: () => void;
  initialContent?: string;
}

export default function ReportGenerationModal({
  hide,
  initialContent,
}: ReportGenerationModalProps) {
  type AppWindow = Window & { config?: { NEXT_API_BASE_URL?: string; NEXT_WS_BASE_URL?: string } };
  const WS_ENV: string | undefined = (window as AppWindow).config?.NEXT_WS_BASE_URL;
  const WS_URL =
    WS_ENV || ((window as AppWindow).config?.NEXT_API_BASE_URL?.replace(/^http/, 'ws') ?? '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; htmlContent: string }>
  >([]);
  const [content, setContent] = useState(initialContent ?? '');
  const [templateName, setTemplateName] = useState('');
  const [isDictationMode, setIsDictationMode] = useState(false);
  const [dictationText, setDictationText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [doctorInfo, setDoctorInfo] = useState<{
    name: string;
    signatureUrl: string;
  } | null>(null);

  const fetchModality = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const studyInstanceUuid = urlParams.get('StudyInstanceUIDs');

      if (!studyInstanceUuid) {
        return undefined;
      }

      const response = await apiClient.get(
        `/dicom/study-by-study-instance-uuid/${studyInstanceUuid}`
      );
      const studyData = response.data;
      const modality = studyData?.patient?.modality;
      return modality;
    } catch (error) {
      return undefined;
    }
  };

  const fetchTemplates = async (modality?: string) => {
    try {
      const response = await apiClient.get('/template', {
        params: modality ? { modality } : undefined,
      });
      setTemplates(response.data);
    } catch (error) {}
  };

  // Helper function to get cookie value
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') {
      return null;
    }
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
  };

  // Fetch doctor details based on userId from URL
  const fetchDoctorDetails = useCallback(async () => {
    try {
      // setIsLoadingDoctor(true);
      // Fetch doctor details on component mount
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId');

      if (!userId) {
        return;
      }

      const token =
        localStorage.getItem('token') ||
        sessionStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('jwt') ||
        sessionStorage.getItem('jwt') ||
        getCookie('authToken') ||
        getCookie('token') ||
        getCookie('accessToken') ||
        getCookie('jwt');

      let response;

      if (token) {
        try {
          response = await apiClient.get(`/user/${userId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (error) {
          response = await apiClient.get(`/user/${userId}`);
        }
      } else {
        response = await apiClient.get(`/user/${userId}`);
      }

      const signaturePath = response.data.signatureURL;
      const signatureUrl = signaturePath
        ? signaturePath.startsWith('http')
          ? signaturePath
          : `${(window as AppWindow).config?.NEXT_API_BASE_URL ?? ''}${signaturePath}`
        : null;

      setDoctorInfo({
        name: response.data.fullName || 'Unknown Doctor',
        signatureUrl: signatureUrl,
      });
    } catch (error) {
    } finally {
      // setIsLoadingDoctor(false);
      // Show success message or notification
    }
  }, []);

  const handleTemplateClick = (template: { id: string; name: string; htmlContent: string }) => {
    const doctorBlock = buildDoctorBlock();
    const composed = `${template.htmlContent || ''}${doctorBlock}`;
    setContent(composed);
    setTemplateName(template.name);
  };

  const handleDictateToAI = () => {
    setIsDictationMode(true);
  };

  const handleCloseDictation = () => {
    setIsDictationMode(false);
    setDictationText('');
  };

  const handleStartRecording = () => {
    if (isRecording) {
      return;
    }
    setIsRecording(true);
    setIsPaused(false);
    setDictationText('');
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          const mr = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000,
          });
          mediaRecorderRef.current = mr;
          mr.ondataavailable = async e => {
            if (e.data && e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              const buf = await e.data.arrayBuffer();
              ws.send(buf);
            }
          };
          mr.start(250);
        } catch (err) {}
      };
      ws.onerror = err => {};
      ws.onclose = () => {};
    } catch (e) {}
  };

  const handlePauseRecording = () => {
    if (!isRecording || isPaused) {
      return;
    }
    try {
      mediaRecorderRef.current?.pause();
      setIsPaused(true);
    } catch (e) {}
  };

  const handleStopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
    } catch (e) {
    } finally {
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const handleSubmitDictation = async () => {
    if (!dictationText && !content) {
      return;
    }
    try {
      setIsAnalyzing(true);
      const response = await apiClient.post('/google-generative-ai/generate', {
        dictationText: dictationText,
        templateContent: content,
      });
      const generated =
        response?.data?.htmlContent ?? response?.data?.content ?? response?.data ?? '';
      if (typeof generated === 'string' && generated.trim().length > 0) {
        setContent(generated);
      }
      handleCloseDictation();
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const buildDoctorBlock = () => {
    const name = doctorInfo?.name || '-';
    const signature = doctorInfo?.signatureUrl
      ? `<img src="${doctorInfo.signatureUrl}" alt="signature" style="width:200px;height:200px;object-fit:contain;margin:0;padding:0;display:block;vertical-align:top;" />`
      : '<span>Not available</span>';
    return `
  <div style="margin-top:24px;border-top:1px solid #444;padding-top:8px">
    <div><strong>Reporting Doctor:</strong> ${name}</div>
    <div style="margin:0;padding:0;line-height:1;"><strong>Signature:</strong><span style="margin:0;padding:0;line-height:1;">${signature}</span></div>
    <div style="height:8px"></div>
  </div>
  `;
  };

  const handleSubmitReport = async (htmlContent: string) => {
    const studyInstanceUID = getStudyInstanceUID();
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');

    if (!htmlContent || htmlContent.trim() === '' || htmlContent === '<p>&nbsp;</p>') {
      return;
    }

    try {
      const report = await apiClient.post('/report', {
        studyInstanceUID: studyInstanceUID,
        htmlContent: htmlContent,
        status: 'submitted',
      });
      if (userId) {
        const origin = window.location.origin;
        window.location.href = `${origin}/doctor/${userId}/reports`;
      } else {
        hide();
      }
    } catch (error) {}
  };

  const handleSaveAsDraft = async (htmlContent: string) => {
    const studyInstanceUID = getStudyInstanceUID();

    if (!htmlContent || htmlContent.trim() === '' || htmlContent === '<p>&nbsp;</p>') {
      return;
    }

    try {
      const draft = await apiClient.post('/report', {
        studyInstanceUID: studyInstanceUID,
        htmlContent: htmlContent,
        status: 'draft',
      });
      alert('Draft saved successfully!');
    } catch (error) {
      alert('Error saving draft. Please try again.');
    }
  };

  const getStudyInstanceUID = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('StudyInstanceUIDs') || '';
  };

  useEffect(() => {
    if (isDropdownOpen && templates.length === 0) {
      fetchTemplates();
    }
  }, [isDropdownOpen, templates.length]);

  useEffect(() => {
    if (typeof initialContent === 'string' && initialContent !== content) {
      setContent(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  useEffect(() => {
    fetchDoctorDetails();
  }, [fetchDoctorDetails]);

  return (
    <div className="container-report flex h-full flex-col p-4">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <DropdownMenu
            open={isDropdownOpen}
            onOpenChange={async open => {
              setIsDropdownOpen(open);
              if (open) {
                const modality = await fetchModality();
                await fetchTemplates(modality);
                if (!content || content.trim() === '') {
                  const doctorBlock = buildDoctorBlock();
                  setContent(doctorBlock);
                }
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <button className="bg-background border-input hover:bg-accent text-foreground hover:text-accent-foreground flex w-full items-center justify-between gap-2 rounded border px-4 py-3 text-base transition-colors">
                <div className="flex items-center">
                  <span>{templateName || 'Select Template'}</span>
                </div>
                <Icons.ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              className="z-50 w-56"
            >
              {templates.length > 0 ? (
                templates.map(template => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                  >
                    <Icons.Export className="mr-2 h-4 w-4" />
                    {template.name}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem>
                  <Icons.Export className="mr-2 h-4 w-4" />
                  Loading templates... (Count: {templates.length})
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!isDictationMode ? (
          <Button
            variant="default"
            size="lg"
            onClick={handleDictateToAI}
            className="bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap px-6 py-3 text-lg"
          >
            Dictate to AI
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            onClick={handleCloseDictation}
            className="whitespace-nowrap px-6 py-3 text-lg"
          >
            Close Dictation
          </Button>
        )}
      </div>

      <div className="h-full min-h-0 flex-1">
        {isDictationMode ? (
          <div className="flex h-full gap-4">
            <div className="flex-1">
              <TinyMCEEditor
                content={content}
                onSubmit={handleSubmitReport}
                onSaveAsDraft={handleSaveAsDraft}
              />
            </div>

            <div className="w-1/2">
              <DictationPanel
                onDictationTextChange={setDictationText}
                onSubmit={handleSubmitDictation}
                wsUrl={WS_URL}
                isAnalyzing={isAnalyzing}
              />
            </div>
          </div>
        ) : (
          <TinyMCEEditor
            content={content}
            onSubmit={handleSubmitReport}
            onSaveAsDraft={handleSaveAsDraft}
          />
        )}
      </div>
    </div>
  );
}

function TinyMCEEditor({
  content,
  onSubmit,
  onSaveAsDraft,
}: {
  content: string;
  onSubmit: (htmlContent: string) => void;
  onSaveAsDraft: (htmlContent: string) => void;
}) {
  const editorRef = useRef<{ getContent: () => string } | null>(null);
  const [hasContent, setHasContent] = useState(false);

  // Update hasContent when content prop changes
  useEffect(() => {
    if (content && content.trim() !== '' && content !== '<p>&nbsp;</p>') {
      setHasContent(true);
    } else {
      setHasContent(false);
    }
  }, [content]);
  const [initialValue, setInitialValue] = useState(content);

  useEffect(() => {
    const editorInstance = editorRef.current as unknown as {
      setContent?: (v: string) => void;
    } | null;
    if (editorInstance?.setContent) {
      editorInstance.setContent(content || '');
      return;
    }
    setInitialValue(content);
  }, [content]);

  return (
    <div className="flex h-full flex-col">
      <div className="h-full min-h-0 flex-1">
        <div className="h-full min-h-0 flex-1 [&_.tox-tinymce]:bg-[#1a1a1a] [&_.tox-edit-area]:bg-[#1a1a1a] [&_.tox-edit-area__iframe]:bg-[#1a1a1a]">
          <Editor
            apiKey="b0ggc7dfi30js013j5ardxxnumm26dhq5duxeqb15qt369l5"
            onInit={(_evt, editor) => (editorRef.current = editor)}
            initialValue={initialValue}
            init={{
              height: '100%',
              min_height: 600,
              menubar: false,
              skin: 'oxide-dark',
              content_css: 'dark',
              plugins: [
                'advlist',
                'autolink',
                'lists',
                'link',
                'image',
                'charmap',
                'preview',
                'anchor',
                'searchreplace',
                'visualblocks',
                'code',
                'fullscreen',
                'insertdatetime',
                'media',
                'table',
                'code',
                'help',
                'wordcount',
              ],
              toolbar:
                'undo redo | blocks | ' +
                'bold italic forecolor | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'removeformat | help',
              content_style: `
                body {
                  font-family: 'Inter', sans-serif;
                  font-size: 14px;
                  background-color: #1a1a1a !important;
                  color: #ffffff !important;
                  margin: 0;
                  padding: 16px;
                }
                p { margin: 0 0 16px 0; color: #ffffff !important; }
                h1, h2, h3, h4, h5, h6 { color: #ffffff !important; }
                ul, ol { color: #ffffff !important; }
                li { color: #ffffff !important; }
                blockquote {
                  border-left: 4px solid #3b82f6;
                  margin: 16px 0;
                  padding-left: 16px;
                  color: #d1d5db !important;
                }
                .mce-content-body {
                  background-color: #1a1a1a !important;
                  color: #ffffff !important;
                }
                .tox-edit-area {
                  background-color: #1a1a1a !important;
                }
                .tox-edit-area__iframe {
                  background-color: #1a1a1a !important;
                }
              `,
              toolbar_mode: 'wrap',
              toolbar_sticky: true,
              toolbar_sticky_offset: 0,
              branding: false,
              elementpath: false,
              resize: false,
              statusbar: false,
              setup: editor => {
                editor.on('init', () => {
                  const iframe = editor.getContainer().querySelector('iframe');
                  if (iframe && iframe.contentDocument) {
                    const style = iframe.contentDocument.createElement('style');
                    style.textContent = `
                      body {
                        background-color: #1a1a1a !important;
                        color: #ffffff !important;
                      }
                      * {
                        color: #ffffff !important;
                      }
                      p, div, span, h1, h2, h3, h4, h5, h6, ul, ol, li {
                        color: #ffffff !important;
                      }
                    `;
                    iframe.contentDocument.head.appendChild(style);
                  }

                  setTimeout(() => {
                    const container = editor.getContainer();
                    if (container) {
                      container.style.backgroundColor = '#1a1a1a';
                      const editArea = container.querySelector('.tox-edit-area');
                      if (editArea) {
                        editArea.style.backgroundColor = '#1a1a1a';
                      }
                    }
                  }, 100);

                  // Check initial content
                  const initialContent = editor.getContent();
                  setHasContent(
                    initialContent &&
                      initialContent.trim() !== '' &&
                      initialContent !== '<p>&nbsp;</p>'
                  );
                });

                // Listen for content changes
                editor.on('input change keyup', () => {
                  const currentContent = editor.getContent();
                  const hasValidContent =
                    currentContent &&
                    currentContent.trim() !== '' &&
                    currentContent !== '<p>&nbsp;</p>';
                  setHasContent(hasValidContent);
                });
              },
            }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          disabled={!hasContent}
          onClick={() => {
            const htmlContent = editorRef.current?.getContent();
            onSaveAsDraft(htmlContent);
          }}
          className="min-w-[140px] px-8 py-3 text-lg"
        >
          Save as Draft
        </Button>
        <Button
          variant="default"
          size="lg"
          disabled={!hasContent}
          onClick={() => {
            const htmlContent = editorRef.current?.getContent();
            onSubmit(htmlContent);
          }}
          className="min-w-[160px] px-12 py-3 text-lg"
        >
          Submit Report
        </Button>
      </div>
    </div>
  );
}

function DictationPanel({
  onDictationTextChange,
  onSubmit,
  isAnalyzing,
  wsUrl,
}: {
  onDictationTextChange: (text: string) => void;
  onSubmit: () => void;
  wsUrl: string;
  isAnalyzing?: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dictationText, setDictationText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const cleanupResources = () => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      setIsPaused(false);
      setDictationText('');
      onDictationTextChange('');
      setConnectionStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = async () => {
        setConnectionStatus('connected');

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;

          const mimeType = 'audio/webm;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            throw new Error('Browser does not support audio/webm;codecs=opus');
          }

          const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            audioBitsPerSecond: 128000,
          });
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = async event => {
            if (event.data && event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              try {
                const arrayBuffer = await event.data.arrayBuffer();
                ws.send(arrayBuffer);
              } catch (error) {}
            }
          };

          mediaRecorder.start(250);
        } catch (error) {
          cleanupResources();
        }
      };
      ws.onmessage = event => {
        const transcript = event.data as string;
        if (transcript && transcript.trim()) {
          setDictationText(prev => {
            const newText = transcript;
            onDictationTextChange(newText);
            return newText;
          });
        }
      };
      ws.onerror = error => {
        setConnectionStatus('disconnected');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
      };
    } catch (error) {
      cleanupResources();
    }
  };

  const handlePauseRecording = () => {
    if (!isRecording || isPaused) {
      return;
    }
    try {
      mediaRecorderRef.current?.pause();
      setIsPaused(true);
    } catch (error) {}
  };

  const handleResumeRecording = () => {
    if (!isRecording || !isPaused) {
      return;
    }
    try {
      mediaRecorderRef.current?.resume();
      setIsPaused(false);
    } catch (error) {}
  };

  const handleStopRecording = () => {
    cleanupResources();
    setIsRecording(false);
    setIsPaused(false);
  };

  const handleSubmit = () => {
    onSubmit();
    setDictationText('');
    onDictationTextChange('');
  };

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Dictation</CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col space-y-4">
        <div className="muted-foreground space-y-1 text-sm">
          <p>Dictate clinical findings and describe what you observe.</p>
          <p>Voice punctuation: say &quot;period&quot;, &quot;comma&quot;, etc...</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={isRecording && !isPaused ? 'default' : 'secondary'}
            size="sm"
            onClick={handleStartRecording}
            disabled={isRecording && !isPaused}
            className="flex-1"
          >
            {isRecording && !isPaused ? 'Recording...' : 'Start'}
          </Button>

          <Button
            variant={isPaused ? 'default' : 'secondary'}
            size="sm"
            onClick={isPaused ? handleResumeRecording : handlePauseRecording}
            disabled={!isRecording}
            className="flex-1"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleStopRecording}
            disabled={!isRecording}
            className="flex-1"
          >
            Stop
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          <div className="h-full overflow-y-auto rounded bg-black p-4 text-white">
            {dictationText ? (
              <p className="whitespace-pre-wrap text-white">{dictationText}</p>
            ) : (
              <p className="muted-foreground text-center">
                {isRecording
                  ? isPaused
                    ? 'Recording paused. Click Resume to continue...'
                    : 'Listening... Speak now.'
                  : 'Click Start to begin dictation...'}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmit}
            disabled={isAnalyzing || !dictationText || dictationText.trim() === ''}
          >
            <img
              src="/assets/icons/ai-analysis.svg"
              alt="AI"
              className="mr-2 h-4 w-4"
            />
            {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

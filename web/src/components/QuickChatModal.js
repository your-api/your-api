import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Card, Avatar, Spin, Toast, TextArea, Upload, Image } from '@douyinfe/semi-ui';
import { IconSend, IconUser, IconSetting, IconClose, IconImage, IconDeleteStroked } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API } from '../helpers';

const QuickChatModal = ({ visible, onClose, modelName }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamContent, setCurrentStreamContent] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);

  // 检查模型是否支持视觉功能
  const isVisionModel = useCallback(() => {
    const visionModels = [
      'gpt-4o', 'gpt-4-vision', 'gpt-4-turbo', 'gpt-4-turbo-vision',
      'claude-3', 'claude-3-sonnet', 'claude-3-opus', 'claude-3-haiku',
      'claude-3-5-sonnet', 'claude-3.5-sonnet',
      'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash',
      'qwen-vl', 'qwen2-vl', 'yi-vision'
    ];
    return visionModels.some(model => modelName.toLowerCase().includes(model.toLowerCase()));
  }, [modelName]);

  // 暂时让所有模型都支持图片上传（用于测试）
  const showImageUpload = true; // 可以改为 isVisionModel() 来只对视觉模型显示

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamContent]);

  // 将文件转换为base64
  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // 去掉 data:image/...;base64, 前缀
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // 处理图片选择
  const handleImageSelect = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      Toast.error(t('请选择图片文件'));
      return;
    }

    // 检查文件大小（限制为10MB）
    if (file.size > 10 * 1024 * 1024) {
      Toast.error(t('图片大小不能超过10MB'));
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      const imageData = {
        id: Date.now(),
        name: file.name,
        type: file.type,
        base64: base64,
        url: URL.createObjectURL(file)
      };
      
      setSelectedImages(prev => [...prev, imageData]);
      Toast.success(t('图片上传成功'));
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      Toast.error(t('图片处理失败'));
    }
  }, [fileToBase64, t]);

  // 删除选中的图片
  const removeImage = useCallback((imageId) => {
    setSelectedImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      // 清理URL对象
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return newImages;
    });
  }, []);

  // 发送消息
  const sendMessage = useCallback(async () => {
    if ((!inputValue.trim() && selectedImages.length === 0) || isStreaming) return;

    // 构建消息内容
    let messageContent = [];
    
    // 添加文本内容
    if (inputValue.trim()) {
      messageContent.push({
        type: 'text',
        text: inputValue.trim()
      });
    }

    // 添加图片内容
    selectedImages.forEach(image => {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${image.type};base64,${image.base64}`
        }
      });
    });

    const userMessage = { 
      role: 'user', 
      content: messageContent.length === 1 && messageContent[0].type === 'text' 
        ? messageContent[0].text  // 纯文本消息保持原格式
        : messageContent          // 包含图片的消息使用数组格式
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setSelectedImages([]);
    setIsStreaming(true);
    setCurrentStreamContent('');

    try {
      // 获取用户的第一个token
      const tokenRes = await API.get('/api/token');
      if (!tokenRes.data.success || !tokenRes.data.data || tokenRes.data.data.length === 0) {
        throw new Error('No token available');
      }
      const userToken = tokenRes.data.data[0].key;

      // 创建AbortController用于取消请求
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: newMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 1000
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setCurrentStreamContent(assistantContent);
              }
              
              // 检查是否完成
              if (parsed.choices?.[0]?.finish_reason) {
                break;
              }
            } catch (e) {
              // 忽略解析错误，继续处理下一行
              console.warn('Failed to parse SSE data:', data, e);
              continue;
            }
          }
        }
      }

      // 流式传输完成，添加到消息列表
      if (assistantContent.trim()) {
        const assistantMessage = { role: 'assistant', content: assistantContent };
        setMessages(prev => [...prev, assistantMessage]);
      }
      setCurrentStreamContent('');
      
    } catch (error) {
      if (error.name === 'AbortError') {
        Toast.warning(t('请求已取消'));
      } else {
        console.error('Stream error:', error);
        let errorMessage = t('发送消息失败，请重试');
        
        // 提供更详细的错误信息
        if (error.message.includes('401')) {
          errorMessage = t('Token认证失败，请检查Token是否有效');
        } else if (error.message.includes('429')) {
          errorMessage = t('请求频率过高，请稍后重试');
        } else if (error.message.includes('404')) {
          errorMessage = t('模型不存在或不可用');
        }
        
        Toast.error(errorMessage);
        // 将失败的消息从列表中移除
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [inputValue, messages, modelName, isStreaming, selectedImages, t]);

  // 停止流式传输
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // 清空对话
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentStreamContent('');
    setSelectedImages([]);
    if (isStreaming) {
      stopStreaming();
    }
  }, [isStreaming, stopStreaming]);

  // 键盘事件处理
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // 关闭模态框时清理状态
  const handleClose = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    }
    // 清理所有图片URL对象
    selectedImages.forEach(image => {
      URL.revokeObjectURL(image.url);
    });
    setSelectedImages([]);
    onClose();
  }, [isStreaming, stopStreaming, selectedImages, onClose]);

  // 渲染消息内容
  const renderMessageContent = useCallback((content) => {
    if (typeof content === 'string') {
      return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</div>;
    }
    
    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item, index) => {
            if (item.type === 'text') {
              return (
                <div key={index} className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {item.text}
                </div>
              );
            } else if (item.type === 'image_url') {
              return (
                <div key={index} className="max-w-xs">
                  <Image
                    src={item.image_url.url}
                    alt="用户上传的图片"
                    style={{ maxWidth: '200px', maxHeight: '200px' }}
                    preview={{
                      src: item.image_url.url
                    }}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }
    
    return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</div>;
  }, []);

  return (
    <Modal
      visible={visible}
      onCancel={handleClose}
      footer={null}
      width="90vw"
      style={{ maxWidth: '800px' }}
      bodyStyle={{ padding: 0, height: '80vh', maxHeight: '600px' }}
      className="quick-chat-modal"
      closeIcon={<IconClose />}
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <IconSetting className="text-blue-500" />
            <span className="font-medium">{t('模型体验')}</span>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {modelName}
            </span>
            {showImageUpload && (
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                {t('支持图片')}
              </span>
            )}
          </div>
          <Button
            theme="borderless"
            type="tertiary"
            size="small"
            onClick={clearMessages}
            disabled={messages.length === 0 && !isStreaming}
          >
            {t('清空对话')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && !currentStreamContent && (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <IconSetting size="large" />
                </div>
                <p className="text-gray-500 mb-2">{t('开始与 {{model}} 对话', { model: modelName })}</p>
                <p className="text-sm text-gray-400">{t('输入消息并按回车发送')}</p>
                {showImageUpload && (
                  <p className="text-sm text-green-600 mt-2">{t('此模型支持图片识别，可以上传图片进行对话')}</p>
                )}
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <Avatar
                    size="small"
                    style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
                  >
                    AI
                  </Avatar>
                )}
                
                <Card
                  className={`max-w-[70%] ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                  bodyStyle={{ padding: '12px 16px' }}
                >
                  {renderMessageContent(message.content)}
                </Card>

                {message.role === 'user' && (
                  <Avatar
                    size="small"
                    icon={<IconUser />}
                    style={{ backgroundColor: '#52c41a', flexShrink: 0 }}
                  />
                )}
              </div>
            ))}

            {/* 流式内容显示 */}
            {currentStreamContent && (
              <div className="flex gap-3 justify-start">
                <Avatar
                  size="small"
                  style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
                >
                  AI
                </Avatar>
                <Card
                  className="max-w-[70%] bg-white border border-gray-200"
                  bodyStyle={{ padding: '12px 16px' }}
                >
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {currentStreamContent}
                    <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
                  </div>
                </Card>
              </div>
            )}

            {isStreaming && !currentStreamContent && (
              <div className="flex gap-3 justify-start">
                <Avatar
                  size="small"
                  style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
                >
                  AI
                </Avatar>
                <Card
                  className="max-w-[70%] bg-white border border-gray-200"
                  bodyStyle={{ padding: '12px 16px' }}
                >
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Spin size="small" />
                    {t('AI 正在思考...')}
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="max-w-4xl mx-auto">
            {/* 图片预览区域 */}
            {selectedImages.length > 0 && (
              <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image) => (
                    <div key={image.id} className="relative">
                      <Image
                        src={image.url}
                        alt={image.name}
                        style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                        className="rounded border"
                        preview={{
                          src: image.url
                        }}
                      />
                      <Button
                        theme="borderless"
                        type="danger"
                        size="small"
                        icon={<IconDeleteStroked />}
                        onClick={() => removeImage(image.id)}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          padding: 0,
                          minWidth: '20px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <TextArea
                  placeholder={t('输入消息...（按 Enter 发送，Shift+Enter 换行）')}
                  value={inputValue}
                  onChange={setInputValue}
                  onKeyDown={handleKeyPress}
                  disabled={isStreaming}
                  autosize={{ minRows: 1, maxRows: 4 }}
                  style={{ resize: 'none' }}
                />
              </div>
              <div className="flex gap-2">
                {/* 图片上传按钮 */}
                {showImageUpload && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageSelect(e.target.files)}
                    />
                    <Button
                      theme="borderless"
                      type="tertiary"
                      icon={<IconImage />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStreaming}
                      size="large"
                    />
                  </>
                )}
                
                {isStreaming && (
                  <Button
                    theme="borderless"
                    type="tertiary"
                    onClick={stopStreaming}
                    size="large"
                  >
                    {t('停止')}
                  </Button>
                )}
                <Button
                  theme="solid"
                  type="primary"
                  icon={<IconSend />}
                  onClick={sendMessage}
                  disabled={(!inputValue.trim() && selectedImages.length === 0) || isStreaming}
                  size="large"
                >
                  {t('发送')}
                </Button>
              </div>
            </div>
            
            {/* 提示信息 */}
            <div className="mt-2 text-xs text-gray-400 text-center">
              {t('当前模型：{{model}}', { model: modelName })} • 
              {t('消息数：{{count}}', { count: messages.length })}
              {showImageUpload && t(' • 支持图片上传')}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .quick-chat-modal .semi-modal-content {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        /* 滚动条美化 */
        .quick-chat-modal ::-webkit-scrollbar {
          width: 6px;
        }
        
        .quick-chat-modal ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .quick-chat-modal ::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        
        .quick-chat-modal ::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.3);
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .quick-chat-modal .semi-modal {
            width: 95vw !important;
            height: 90vh !important;
            margin: 5vh auto !important;
          }
          
          .quick-chat-modal .semi-modal-content {
            height: 100%;
          }
        }
      `}</style>
    </Modal>
  );
};

export default QuickChatModal; 
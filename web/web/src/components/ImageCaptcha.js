import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Spin, Space } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { API, showError } from '../helpers';
import { useTranslation } from 'react-i18next';

const ImageCaptcha = ({ onVerified, onError, style = {} }) => {
  const { t } = useTranslation();
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 使用ref来避免回调函数的依赖问题
  const onVerifiedRef = useRef(onVerified);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onErrorRef.current = onError;
  }, [onVerified, onError]);

  // 生成验证码
  const generateCaptcha = async () => {
    setLoading(true);
    try {
      const response = await API.get('/api/captcha/image/base64');
      if (response.data.success) {
        setCaptchaId(response.data.captcha_id);
        setCaptchaImage(response.data.image);
        setCaptchaCode('');
      } else {
        showError(response.data.message || '获取验证码失败');
        if (onErrorRef.current) onErrorRef.current(response.data.message || '获取验证码失败');
      }
    } catch (error) {
      console.error('验证码生成失败:', error);
      showError('验证码生成失败，请稍后重试');
      if (onErrorRef.current) onErrorRef.current('验证码生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 确认验证码（不调用验证API，直接传递给父组件）
  const confirmCaptcha = () => {
    if (!captchaId || !captchaCode) {
      showError('请输入验证码');
      return;
    }

    if (captchaCode.length < 4) {
      showError('请输入完整的验证码');
      return;
    }

    // 直接传递验证码数据给父组件，不在这里验证
    if (onVerifiedRef.current) {
      onVerifiedRef.current({
        captcha_id: captchaId,
        captcha_code: captchaCode
      });
    }
  };

  // 只在组件挂载时生成一次验证码
  useEffect(() => {
    generateCaptcha();
  }, []); // 空依赖数组，只在挂载时执行一次

  // 处理输入变化
  const handleInputChange = (value) => {
    setCaptchaCode(value);
    // 移除自动确认功能，需要手动点击确认按钮
  };

  // 处理键盘按键
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      confirmCaptcha();
    }
  };

  // 刷新验证码时清空输入
  const handleRefresh = () => {
    setCaptchaCode('');
    generateCaptcha();
  };

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      ...style 
    }}>
      {/* 验证码图片区域 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        justifyContent: 'center'
      }}>
        <div style={{ 
          border: '2px solid var(--semi-color-border)',
          borderRadius: '8px', 
          padding: '8px',
          backgroundColor: 'var(--semi-color-fill-0)',
          minWidth: '160px',
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {loading ? (
            <Spin size="small" />
          ) : captchaImage ? (
            <img 
              src={captchaImage} 
              alt="验证码" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
              onClick={handleRefresh}
              title="点击刷新验证码"
            />
          ) : (
            <div style={{ 
              color: 'var(--semi-color-text-2)', 
              fontSize: '12px',
              textAlign: 'center'
            }}>
              {t('点击生成验证码')}
            </div>
          )}
        </div>
        
        <Button 
          icon={<IconRefresh />} 
          size="default"
          loading={loading}
          onClick={handleRefresh}
          title={t('刷新验证码')}
          type="tertiary"
        />
      </div>
      
      {/* 输入和确认区域 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        justifyContent: 'center'
      }}>
        <Input
          placeholder={t('请输入验证码')}
          value={captchaCode}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          style={{ 
            width: '140px',
            textAlign: 'center',
            fontSize: '16px',
            letterSpacing: '2px'
          }}
          maxLength={4}
          disabled={!captchaId}
          size="default"
        />
        
        <Button
          type="primary"
          size="default"
          disabled={!captchaId || !captchaCode || captchaCode.length < 4}
          onClick={confirmCaptcha}
          style={{ minWidth: '60px' }}
        >
          {t('确认')}
        </Button>
      </div>
      
      {/* 提示文字 */}
      <div style={{ 
        textAlign: 'center',
        color: 'var(--semi-color-text-2)',
        fontSize: '12px',
        marginTop: '4px'
      }}>
        {t('看不清？点击图片或刷新按钮重新获取')}
      </div>
    </div>
  );
};

export default ImageCaptcha; 
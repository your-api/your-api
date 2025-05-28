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
    // 当输入4位验证码时，自动确认
    if (value && value.length === 4 && captchaId) {
      setTimeout(() => {
        if (onVerifiedRef.current) {
          onVerifiedRef.current({
            captcha_id: captchaId,
            captcha_code: value
          });
        }
      }, 100); // 短暂延迟确保输入完成
    }
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
    <div style={{ ...style }}>
      <Space vertical align="start" spacing={8}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ 
            border: '1px solid #e0e0e0', 
            borderRadius: '6px', 
            padding: '4px',
            backgroundColor: '#f9f9f9',
            minWidth: '150px',
            minHeight: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
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
                  cursor: 'pointer'
                }}
                onClick={handleRefresh}
                title="点击刷新验证码"
              />
            ) : (
              <div style={{ color: '#999', fontSize: '12px' }}>
                点击生成验证码
              </div>
            )}
          </div>
          
          <Button 
            icon={<IconRefresh />} 
            size="small"
            loading={loading}
            onClick={handleRefresh}
            title={t('刷新验证码')}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            placeholder={t('请输入验证码')}
            value={captchaCode}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            style={{ width: '120px' }}
            maxLength={4}
            disabled={!captchaId}
          />
          
          <Button
            type="primary"
            size="small"
            disabled={!captchaId || !captchaCode || captchaCode.length < 4}
            onClick={confirmCaptcha}
          >
            {t('确认')}
          </Button>
        </div>
      </Space>
    </div>
  );
};

export default ImageCaptcha; 
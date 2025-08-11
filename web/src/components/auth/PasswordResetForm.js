import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API, showError, showInfo, showSuccess, getLogo } from '../../helpers';
import Turnstile from 'react-turnstile';
import { 
  Button, 
  Form, 
  Card, 
  Layout, 
  Tabs, 
  TabPane, 
  Modal,
  Typography,
  Input,
  Toast
} from '@douyinfe/semi-ui';
import { IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import ImageCaptcha from '../ImageCaptcha';

const { Title, Text } = Typography;

const PasswordResetForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inputs, setInputs] = useState({
    email: '',
    phone: '',
    phone_code: '',
    new_password: '',
    confirm_password: '',
  });
  const { email, phone, phone_code, new_password, confirm_password } = inputs;
  const [activeTabKey, setActiveTabKey] = useState(() => {
    const from = searchParams.get('from');
    return from === 'phone' ? 'phone' : 'email';
  });
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const phoneCountdownRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // 图像验证码相关状态
  const [showImageCaptcha, setShowImageCaptcha] = useState(false);
  const [imageCaptchaId, setImageCaptchaId] = useState('');
  const [imageCaptchaCode, setImageCaptchaCode] = useState('');

  // 密码显示状态
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const logo = getLogo();

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  // 手机号倒计时逻辑
  useEffect(() => {
    if (phoneCountdown > 0) {
      phoneCountdownRef.current = setTimeout(() => {
        setPhoneCountdown(phoneCountdown - 1);
      }, 1000);
    }
    return () => {
      if (phoneCountdownRef.current) {
        clearTimeout(phoneCountdownRef.current);
      }
    };
  }, [phoneCountdown]);

  // 获取系统状态
  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
  }, []);

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  // 处理图像验证码验证成功
  const handleImageCaptchaSuccess = (captchaData) => {
    setImageCaptchaId(captchaData.captcha_id);
    setImageCaptchaCode(captchaData.captcha_code);
    setShowImageCaptcha(false);
    // 验证成功后发送短信
    sendSMSAfterCaptcha(captchaData.captcha_id, captchaData.captcha_code);
  };

  // 发送手机验证码 - 先显示图像验证码
  const sendPhoneVerificationCode = async () => {
    if (!phone) {
      showError(t('请输入手机号'));
      return;
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      showError(t('请输入正确的手机号格式'));
      return;
    }

    // 显示图像验证码
    setShowImageCaptcha(true);
  };

  // 图像验证码验证成功后发送短信
  const sendSMSAfterCaptcha = async (captchaId, captchaCode) => {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/sms/send', {
        phone: phone,
        code: captchaCode,
        purpose: 'reset_password',
        image_captcha_id: captchaId,
        image_captcha_code: captchaCode,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('验证码发送成功！'));
        setPhoneCountdown(60);
        // 清空图像验证码
        setImageCaptchaId('');
        setImageCaptchaCode('');
      } else {
        showError(message || t('发送验证码失败'));
      }
    } catch (error) {
      showError(t('网络错误，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  // 邮箱重置
  const handleEmailReset = async () => {
    if (!email) {
      showError(t('请输入邮箱地址'));
      return;
    }
    
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    
    setDisableButton(true);
    setLoading(true);
    
    try {
      const res = await API.get(
        `/api/reset_password?email=${email}&turnstile=${turnstileToken}`,
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('重置邮件发送成功，请检查邮箱！'));
        setInputs({ ...inputs, email: '' });
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('网络错误，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  // 手机重置
  const handlePhoneReset = async () => {
    if (!phone || !phone_code || !new_password || !confirm_password) {
      showError(t('请填写所有必填项'));
      return;
    }

    if (new_password !== confirm_password) {
      showError(t('两次输入的密码不一致'));
      return;
    }

    if (new_password.length < 6) {
      showError(t('密码长度至少6位'));
      return;
    }
    
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await API.post('/api/reset_password_phone', {
        phone: phone,
        phone_code: phone_code,
        new_password: new_password,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('密码重置成功！'));
        setInputs({ 
          phone: '', 
          phone_code: '', 
          new_password: '', 
          confirm_password: '' 
        });
        // 延迟1.5秒后跳转到登录页
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('网络错误，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  // 渲染邮箱重置界面
  const renderEmailReset = () => (
    <div style={{ padding: '20px 0' }}>
      <Form>
        <Form.Input
          field={'email'}
          label={t('邮箱地址')}
          placeholder={t('请输入邮箱地址')}
          name='email'
          value={email}
          onChange={(value) => handleChange('email', value)}
          style={{ marginBottom: 20 }}
        />
        
        <Button
          theme='solid'
          style={{ width: '100%' }}
          type={'primary'}
          size='large'
          onClick={handleEmailReset}
          loading={loading}
          disabled={disableButton}
        >
          {disableButton ? `${t('重试')} (${countdown})` : t('发送重置邮件')}
        </Button>
      </Form>
      
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <Text type="secondary">
            {t('记起密码了？')}
          </Text>
          <Button
            theme="solid"
            type="secondary"
            size="small"
            onClick={() => navigate('/login')}
            style={{
              backgroundColor: '#1890ff',
              borderColor: '#1890ff',
              fontWeight: 500
            }}
          >
            {t('返回登录')}
          </Button>
        </div>
      </div>
    </div>
  );

  // 渲染手机重置界面
  const renderPhoneReset = () => (
    <div style={{ padding: '20px 0' }}>
      <Form>
        <Form.Input
          field={'phone'}
          label={t('手机号')}
          placeholder={t('请输入手机号')}
          name='phone'
          value={phone}
          onChange={(value) => handleChange('phone', value)}
          style={{ marginBottom: 20 }}
        />
        
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--semi-color-text-0)' 
            }}>
              {t('新密码')}
            </label>
          </div>
          <Input
            placeholder={t('请输入新密码')}
            name='new_password'
            type={showNewPassword ? 'text' : 'password'}
            value={new_password}
            onChange={(value) => handleChange('new_password', value)}
            suffix={
              <Button
                type="tertiary"
                theme="borderless"
                icon={showNewPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{ padding: '4px' }}
              />
            }
            style={{ height: '40px' }}
          />
          {new_password && new_password.length < 6 && (
            <div style={{ 
              color: 'var(--semi-color-danger)', 
              fontSize: '12px', 
              marginTop: '4px' 
            }}>
              {t('密码长度至少6位')}
            </div>
          )}
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--semi-color-text-0)' 
            }}>
              {t('确认新密码')}
            </label>
          </div>
          <Input
            placeholder={t('请再次输入新密码')}
            name='confirm_password'
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirm_password}
            onChange={(value) => handleChange('confirm_password', value)}
            suffix={
              <Button
                type="tertiary"
                theme="borderless"
                icon={showConfirmPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ padding: '4px' }}
              />
            }
            style={{ height: '40px' }}
          />
          {confirm_password && new_password && confirm_password !== new_password && (
            <div style={{ 
              color: 'var(--semi-color-danger)', 
              fontSize: '12px', 
              marginTop: '4px' 
            }}>
              {t('两次输入的密码不一致')}
            </div>
          )}
          {confirm_password && new_password && confirm_password === new_password && new_password.length >= 6 && (
            <div style={{ 
              color: 'var(--semi-color-success)', 
              fontSize: '12px', 
              marginTop: '4px' 
            }}>
              {t('密码确认正确')}
            </div>
          )}
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--semi-color-text-0)' 
            }}>
              {t('短信验证码')}
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <Input
              placeholder={t('请输入验证码')}
              name='phone_code'
              value={phone_code}
              onChange={(value) => handleChange('phone_code', value)}
              style={{ flex: 1, height: '40px' }}
            />
            <Button
              type='secondary'
              onClick={sendPhoneVerificationCode}
              disabled={loading || phoneCountdown > 0}
              loading={loading}
              style={{ height: '40px', minWidth: '100px' }}
            >
              {phoneCountdown > 0 ? `${phoneCountdown}${t('秒')}` : t('获取验证码')}
            </Button>
          </div>
        </div>
        
        <Button
          theme='solid'
          style={{ width: '100%' }}
          type={'primary'}
          size='large'
          onClick={handlePhoneReset}
          loading={loading}
        >
          {t('重置密码')}
        </Button>
      </Form>
      
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <Text type="secondary">
            {t('记起密码了？')}
          </Text>
          <Button
            theme="solid"
            type="secondary"
            size="small"
            onClick={() => navigate('/login')}
            style={{
              backgroundColor: '#1890ff',
              borderColor: '#1890ff',
              fontWeight: 500
            }}
          >
            {t('返回登录')}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Layout>
        <Layout.Header></Layout.Header>
        <Layout.Content>
          <div
            style={{
              justifyContent: 'center',
              display: 'flex',
              marginTop: 5,
              minHeight: 'calc(100vh - 80px)',
              alignItems: 'flex-start',
              paddingTop: '2rem',
            }}
          >
            <div style={{ width: 500, maxWidth: '90vw' }}>
              <Card 
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <Title 
                    heading={2} 
                    style={{ 
                      marginBottom: 8,
                      fontSize: '1.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {t('密码重置')}
                  </Title>
                  <Text type="secondary" style={{ fontSize: '0.9rem' }}>
                    {t('选择重置方式找回您的密码')}
                  </Text>
                </div>
                
                <Tabs 
                  activeKey={activeTabKey} 
                  onChange={setActiveTabKey}
                  centered
                  style={{ marginBottom: 8 }}
                >
                  <TabPane 
                    tab={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{t('邮箱重置')}</span>
                      </div>
                    } 
                    itemKey="email"
                  >
                    {renderEmailReset()}
                  </TabPane>
                  
                  <TabPane 
                    tab={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{t('手机重置')}</span>
                      </div>
                    } 
                    itemKey="phone"
                  >
                    {renderPhoneReset()}
                  </TabPane>
                </Tabs>
              </Card>
              
              {turnstileEnabled && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: 20,
                  }}
                >
                  <Turnstile
                    sitekey={turnstileSiteKey}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </Layout.Content>
      </Layout>

      {/* 图像验证码模态框 */}
      <Modal
        title={t('请完成验证')}
        visible={showImageCaptcha}
        onCancel={() => setShowImageCaptcha(false)}
        footer={null}
        width={450}
        centered
        bodyStyle={{ 
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <div style={{ 
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: 'var(--semi-color-text-1)',
            marginBottom: '8px'
          }}>
            {t('为了您的账户安全，请完成图像验证')}
          </div>
        </div>
        
        <ImageCaptcha
          onVerified={handleImageCaptchaSuccess}
          onError={() => setShowImageCaptcha(false)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        />
      </Modal>
    </div>
  );
};

export default PasswordResetForm;

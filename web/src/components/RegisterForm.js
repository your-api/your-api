import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
} from '../helpers';
import Turnstile from 'react-turnstile';
import {
  Button,
  Card,
  Divider,
  Form,
  Icon,
  Layout,
  Modal,
  Tabs,
  TabPane,
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { IconGithubLogo } from '@douyinfe/semi-icons';
import {
  onGitHubOAuthClicked,
  onLinuxDOOAuthClicked,
  onOIDCClicked,
} from './utils.js';
import OIDCIcon from './OIDCIcon.js';
import LinuxDoIcon from './LinuxDoIcon.js';
import WeChatIcon from './WeChatIcon.js';
import ImageCaptcha from './ImageCaptcha.js';
import TelegramLoginButton from 'react-telegram-login/src';
import { setUserData } from '../helpers/data.js';
import { UserContext } from '../context/User/index.js';
import { useTranslation } from 'react-i18next';

const RegisterForm = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    password2: '',
    email: '',
    verification_code: '',
    phone: '',
    phone_code: '',
  });
  const { username, password, password2 } = inputs;
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  
  // 根据URL参数设置默认标签页
  const getDefaultTabKey = () => {
    const fromParam = searchParams.get('from');
    if (fromParam === 'phone') {
      return 'phone';
    }
    return 'email'; // 默认显示邮箱注册或从密码登录来的
  };
  
  const [activeTabKey, setActiveTabKey] = useState(getDefaultTabKey());
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const phoneCountdownRef = useRef(null);
  const [userState, userDispatch] = useContext(UserContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [status, setStatus] = useState({});
  const [imageCaptchaData, setImageCaptchaData] = useState(null);
  const [showImageCaptcha, setShowImageCaptcha] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);
  let navigate = useNavigate();
  const logo = getLogo();

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) {
    localStorage.setItem('aff', affCode);
  }

  // 监听URL参数变化，更新活动标签页
  useEffect(() => {
    const fromParam = searchParams.get('from');
    if (fromParam === 'phone') {
      setActiveTabKey('phone');
    } else {
      setActiveTabKey('email');
    }
  }, [searchParams]);

  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      setStatus(status);
      setShowEmailVerification(status.email_verification);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
  });

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown]);

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

  const onWeChatLoginClicked = () => {
    setShowWeChatLoginModal(true);
  };

  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    const res = await API.get(
      `/api/oauth/wechat?code=${inputs.wechat_verification_code}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
      localStorage.setItem('user', JSON.stringify(data));
      setUserData(data);
      updateAPI();
      navigate('/');
      showSuccess('登录成功！');
      setShowWeChatLoginModal(false);
    } else {
      showError(message);
    }
  };

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if (password.length < 8) {
      showInfo('密码长度不得小于 8 位！');
      return;
    }
    if (password !== password2) {
      showInfo('两次输入的密码不一致');
      return;
    }
    
    // 验证注册方式
    if (activeTabKey === 'email') {
      // 邮箱注册验证
      if (!username) {
        showError('请输入用户名');
        return;
      }
      if (showEmailVerification) {
        if (!inputs.email) {
          showError('请输入邮箱地址');
          return;
        }
        const emailDomain = inputs.email.split('@')[1];
        if (emailDomain !== 'qq.com' && emailDomain !== 'gmail.com') {
          showError('仅支持QQ邮箱(@qq.com)和Gmail邮箱(@gmail.com)');
          return;
        }
        if (!inputs.verification_code) {
          showError('请输入邮箱验证码');
          return;
        }
      }
    } else if (activeTabKey === 'phone') {
      // 手机号注册验证
      if (!inputs.phone) {
        showError('请输入手机号');
        return;
      }
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(inputs.phone)) {
        showError('请输入正确的手机号格式');
        return;
      }
      if (!inputs.phone_code) {
        showError('请输入手机验证码');
        return;
      }
      // 手机注册时，将手机号设置为用户名
      inputs.username = inputs.phone;
    }
    
    // 根据注册方式检查必填字段
    const isEmailRegister = activeTabKey === 'email';
    const isPhoneRegister = activeTabKey === 'phone';
    
    if ((isEmailRegister && username && password) || (isPhoneRegister && inputs.phone && password)) {
      if (turnstileEnabled && turnstileToken === '') {
        showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
        return;
      }
      setLoading(true);
      if (!affCode) {
        affCode = localStorage.getItem('aff');
      }
      inputs.aff_code = affCode;
      const res = await API.post(
        `/api/user/register?turnstile=${turnstileToken}`,
        inputs,
      );
      const { success, message } = res.data;
      if (success) {
        navigate('/login');
        showSuccess('注册成功！');
      } else {
        showError(message);
      }
      setLoading(false);
    }
  }

  // 处理图片验证码验证成功
  const handleImageCaptchaVerified = (captchaData) => {
    setImageCaptchaData(captchaData);
    setShowImageCaptcha(false);
    // 根据当前选中的tab发送对应的验证码
    if (activeTabKey === 'email') {
      // 验证成功后自动发送邮箱验证码
      sendEmailVerificationAfterCaptcha(captchaData);
    } else if (activeTabKey === 'phone') {
      // 验证成功后自动发送手机验证码
      sendPhoneVerificationAfterCaptcha(captchaData);
    }
  };

  // 图片验证码验证失败或错误
  const handleImageCaptchaError = (error) => {
    console.error('图片验证码错误:', error);
    setImageCaptchaData(null);
    // 重新显示验证码对话框
    setShowImageCaptcha(true);
  };

  // 发送邮箱验证码（在图片验证码验证成功后）
  const sendEmailVerificationAfterCaptcha = async (captchaData) => {
    if (inputs.email === '') return;
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setLoading(true);
    try {
      const res = await API.get(
        `/api/verification?email=${inputs.email}&turnstile=${turnstileToken}&image_captcha_id=${captchaData.captcha_id}&image_captcha_code=${captchaData.captcha_code}`,
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess('验证码发送成功，请检查你的邮箱！');
        setCountdown(60); // 开始60秒倒计时
      } else {
        showError(message);
        // 如果发送失败，提示用户重新验证
        if (message.includes('图片验证码') || message.includes('验证码错误') || message.includes('已过期')) {
          showInfo('请重新完成图片验证码验证');
          setImageCaptchaData(null);
          setShowImageCaptcha(true);
        }
      }
    } catch (error) {
      showError('发送验证码失败，请重试');
      // 网络错误时也提示重新验证
      showInfo('请重新完成图片验证码验证');
      setImageCaptchaData(null);
      setShowImageCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  // 点击获取验证码按钮
  const sendVerificationCode = async () => {
    if (inputs.email === '') {
      showError('请先输入邮箱地址');
      return;
    }
    
    // 检查邮箱域名是否为QQ或Gmail
    const emailDomain = inputs.email.split('@')[1];
    if (emailDomain !== 'qq.com' && emailDomain !== 'gmail.com') {
      showError('仅支持QQ邮箱(@qq.com)和Gmail邮箱(@gmail.com)');
      return;
    }
    
    // 显示图片验证码模态框
    setShowImageCaptcha(true);
  };

  // 发送手机验证码（在图片验证码验证成功后）
  const sendPhoneVerificationAfterCaptcha = async (captchaData) => {
    if (inputs.phone === '') return;
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/sms/send', {
        phone: inputs.phone,
        purpose: 'register',
        image_captcha_id: captchaData.captcha_id,
        image_captcha_code: captchaData.captcha_code,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess('验证码发送成功，请检查你的手机！');
        setPhoneCountdown(60); // 开始60秒倒计时
      } else {
        showError(message);
        // 如果发送失败，提示用户重新验证
        if (message.includes('图片验证码') || message.includes('验证码错误') || message.includes('已过期')) {
          showInfo('请重新完成图片验证码验证');
          setImageCaptchaData(null);
          setShowImageCaptcha(true);
        }
      }
    } catch (error) {
      showError('发送验证码失败，请重试');
      // 网络错误时也提示重新验证
      showInfo('请重新完成图片验证码验证');
      setImageCaptchaData(null);
      setShowImageCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  // 点击获取手机验证码按钮
  const sendPhoneVerificationCode = async () => {
    if (inputs.phone === '') {
      showError('请先输入手机号');
      return;
    }
    
    // 检查手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(inputs.phone)) {
      showError('请输入正确的手机号格式');
      return;
    }
    
    // 显示图片验证码模态框
    setShowImageCaptcha(true);
  };

  const onTelegramLoginClicked = async (response) => {
    const fields = [
      'id',
      'first_name',
      'last_name',
      'username',
      'photo_url',
      'auth_date',
      'hash',
      'lang',
    ];
    const params = {};
    fields.forEach((field) => {
      if (response[field]) {
        params[field] = response[field];
      }
    });
    const res = await API.get(`/api/oauth/telegram/login`, { params });
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
      localStorage.setItem('user', JSON.stringify(data));
      showSuccess('登录成功！');
      setUserData(data);
      updateAPI();
      navigate('/');
    } else {
      showError(message);
    }
  };

  return (
    <div>
      <Layout>
        <Layout.Header></Layout.Header>
        <Layout.Content>
          <div
            style={{
              justifyContent: 'center',
              display: 'flex',
              marginTop: 120,
            }}
          >
            <div style={{ width: 500 }}>
              <Card>
                <Title heading={2} style={{ textAlign: 'center', marginBottom: 16 }}>
                  {t('新用户注册')}
                </Title>
                
                {/* Tab切换 */}
                <Tabs 
                  activeKey={activeTabKey} 
                  onChange={setActiveTabKey}
                  centered
                  style={{ marginBottom: 16 }}
                >
                  <TabPane 
                    tab={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zM16 8v6m0-6c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V8zm0 0V7a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3v0" />
                        </svg>
                        <span>{t('邮箱注册')}</span>
                      </div>
                    } 
                    itemKey="email"
                  >
                    <Form size='large'>
                      <Form.Input
                        field={'username'}
                        label={t('用户名')}
                        placeholder={t('用户名')}
                        name='username'
                        onChange={(value) => handleChange('username', value)}
                      />
                      <Form.Input
                        field={'password'}
                        label={t('密码')}
                        placeholder={t('输入密码，最短 8 位，最长 20 位')}
                        name='password'
                        type='password'
                        onChange={(value) => handleChange('password', value)}
                      />
                      <Form.Input
                        field={'password2'}
                        label={t('确认密码')}
                        placeholder={t('确认密码')}
                        name='password2'
                        type='password'
                        onChange={(value) => handleChange('password2', value)}
                      />
                      {showEmailVerification ? (
                        <>
                          <Form.Input
                            field={'email'}
                            label={t('邮箱(仅限QQ/谷歌邮箱)')}
                            placeholder={t('输入邮箱地址')}
                            onChange={(value) => handleChange('email', value)}
                            name='email'
                            type='email'
                            suffix={
                              <Button
                                onClick={sendVerificationCode}
                                disabled={loading || countdown > 0}
                                size="small"
                              >
                                {countdown > 0 ? `${countdown}秒后重试` : t('获取验证码')}
                              </Button>
                            }
                          />
                          <Form.Input
                            field={'verification_code'}
                            label={t('验证码')}
                            placeholder={t('输入验证码')}
                            onChange={(value) =>
                              handleChange('verification_code', value)
                            }
                            name='verification_code'
                          />
                        </>
                      ) : (
                        <></>
                      )}
                      <Button
                        theme='solid'
                        style={{ width: '100%' }}
                        type={'primary'}
                        size='large'
                        htmlType={'submit'}
                        onClick={handleSubmit}
                        loading={loading}
                      >
                        {t('注册')}
                      </Button>
                    </Form>
                  </TabPane>
                  
                  <TabPane 
                    tab={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{t('手机注册')}</span>
                      </div>
                    } 
                    itemKey="phone"
                  >
                    <Form size='large'>
                      <Form.Input
                        field={'phone'}
                        label={t('手机号')}
                        placeholder={t('请输入手机号')}
                        name='phone'
                        onChange={(value) => handleChange('phone', value)}
                      />
                      <Form.Input
                        field={'password'}
                        label={t('密码')}
                        placeholder={t('输入密码，最短 8 位，最长 20 位')}
                        name='password'
                        type='password'
                        onChange={(value) => handleChange('password', value)}
                      />
                      <Form.Input
                        field={'password2'}
                        label={t('确认密码')}
                        placeholder={t('确认密码')}
                        name='password2'
                        type='password'
                        onChange={(value) => handleChange('password2', value)}
                      />
                      <Form.Input
                        field={'phone_code'}
                        label={t('验证码')}
                        placeholder={t('请输入短信验证码')}
                        name='phone_code'
                        onChange={(value) => handleChange('phone_code', value)}
                        suffix={
                          <Button
                            onClick={sendPhoneVerificationCode}
                            disabled={loading || phoneCountdown > 0}
                            loading={loading}
                            size="small"
                          >
                            {phoneCountdown > 0 ? `${phoneCountdown}秒后重试` : t('获取验证码')}
                          </Button>
                        }
                      />
                      <Button
                        theme='solid'
                        style={{ width: '100%' }}
                        type={'primary'}
                        size='large'
                        htmlType={'submit'}
                        onClick={handleSubmit}
                        loading={loading}
                      >
                        {t('注册')}
                      </Button>
                    </Form>
                  </TabPane>
                </Tabs>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 20,
                  }}
                >
                  <Text>
                    {t('已有账户？')}
                    <Link to='/login'>{t('点击登录')}</Link>
                  </Text>
                </div>
                {status.github_oauth ||
                status.oidc_enabled ||
                status.wechat_login ||
                status.telegram_oauth ||
                status.linuxdo_oauth ? (
                  <>
                    <Divider margin='12px' align='center'>
                      {t('第三方登录')}
                    </Divider>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginTop: 20,
                      }}
                    >
                      {status.github_oauth ? (
                        <Button
                          type='primary'
                          icon={<IconGithubLogo />}
                          onClick={() =>
                            onGitHubOAuthClicked(status.github_client_id)
                          }
                        />
                      ) : (
                        <></>
                      )}
                      {status.oidc_enabled ? (
                        <Button
                          type='primary'
                          icon={<OIDCIcon />}
                          onClick={() =>
                            onOIDCClicked(
                              status.oidc_authorization_endpoint,
                              status.oidc_client_id,
                            )
                          }
                        />
                      ) : (
                        <></>
                      )}
                      {status.linuxdo_oauth ? (
                        <Button
                          icon={<LinuxDoIcon />}
                          onClick={() =>
                            onLinuxDOOAuthClicked(status.linuxdo_client_id)
                          }
                        />
                      ) : (
                        <></>
                      )}
                    </div>
                    {status.telegram_oauth ? (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginTop: 5,
                          }}
                        >
                          <TelegramLoginButton
                            dataOnauth={onTelegramLoginClicked}
                            botName={status.telegram_bot_name}
                          />
                        </div>
                      </>
                    ) : (
                      <></>
                    )}
                  </>
                ) : (
                  <></>
                )}
              </Card>

              {/* 图片验证码模态框 */}
              <Modal
                title={t('请完成图片验证码验证')}
                visible={showImageCaptcha}
                onCancel={() => setShowImageCaptcha(false)}
                footer={null}
                width={400}
                centered
              >
                <div style={{ padding: '20px 0' }}>
                  <p style={{ marginBottom: '20px', textAlign: 'center', color: '#666' }}>
                    {t('为了防止恶意操作，请先完成图片验证码验证')}
                  </p>
                  <ImageCaptcha
                    onVerified={handleImageCaptchaVerified}
                    onError={handleImageCaptchaError}
                    style={{ display: 'flex', justifyContent: 'center' }}
                  />
                </div>
              </Modal>

              <Modal
                title={t('微信扫码登录')}
                visible={showWeChatLoginModal}
                maskClosable={true}
                onOk={onSubmitWeChatVerificationCode}
                onCancel={() => setShowWeChatLoginModal(false)}
                okText={t('登录')}
                size={'small'}
                centered={true}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItem: 'center',
                    flexDirection: 'column',
                  }}
                >
                  <img src={status.wechat_qrcode} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p>
                    {t(
                      '微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）',
                    )}
                  </p>
                </div>
                <Form size='large'>
                  <Form.Input
                    field={'wechat_verification_code'}
                    placeholder={t('验证码')}
                    label={t('验证码')}
                    value={inputs.wechat_verification_code}
                    onChange={(value) =>
                      handleChange('wechat_verification_code', value)
                    }
                  />
                </Form>
              </Modal>
              {turnstileEnabled ? (
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
              ) : (
                <></>
              )}
            </div>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default RegisterForm;

import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../context/User';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  setUserData
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
  TabPane,
  Tabs,
  Spin,
  Input,
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import TelegramLoginButton from 'react-telegram-login';

import { IconGithubLogo, IconAlarm, IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import OIDCIcon from './common/logo/OIDCIcon.js';
import WeChatIcon from './common/logo/WeChatIcon';
import LinuxDoIcon from './common/logo/LinuxDoIcon.js';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import './LoginForm.css';

const LoginForm = () => {
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    wechat_verification_code: '',
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const { username, password } = inputs;
  const [userState, userDispatch] = useContext(UserContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  let navigate = useNavigate();
  const [status, setStatus] = useState({});
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const { t } = useTranslation();

  // 新增：微信扫码登录相关状态
  const [activeTabKey, setActiveTabKey] = useState('qr'); // 默认显示扫码登录
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrStatus, setQrStatus] = useState('waiting'); // waiting, success, error, expired
  const [qrMessage, setQrMessage] = useState('');
  const [loginProcessed, setLoginProcessed] = useState(false); // 防止重复处理登录
  const qrCheckTimerRef = useRef(null);

  // 新增：手机号登录相关状态
  const [phoneInputs, setPhoneInputs] = useState({
    phone: '',
    password: '',
  });
  const [phoneLoading, setPhoneLoading] = useState(false);

  // 密码显示状态
  const [showPhonePassword, setShowPhonePassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const logo = getLogo();

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) {
    localStorage.setItem('aff', affCode);
  }

  useEffect(() => {
    if (searchParams.get('expired')) {
      showError(t('未登录或登录已过期，请重新登录'));
    }
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      setStatus(status);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
  }, []);

  // 新增：tab切换时的处理
  useEffect(() => {
    if (activeTabKey === 'qr' && status.wechat_login) {
      // 切换到扫码登录时获取二维码
      if (!qrCodeData) {
        getWeChatQRCode();
      }
    }
  }, [activeTabKey, status.wechat_login]);

  // 新增：获取微信二维码
  const getWeChatQRCode = async () => {
    setQrLoading(true);
    setQrStatus('waiting');
    setQrMessage(t('正在获取二维码...'));
    setLoginProcessed(false);
    
    try {
      const res = await API.get('/api/oauth/wechat/qr');
      const { success, data, message } = res.data;
      
      if (success && data) {
        setQrCodeData(data);
        setQrMessage(t('请使用微信扫码登录'));
        // 开始检查登录状态
        startCheckWeChatLogin(data.ticket);
      } else {
        setQrStatus('error');
        setQrMessage(message || t('获取二维码失败'));
      }
    } catch (error) {
      setQrStatus('error');
      setQrMessage(t('获取二维码失败，请刷新重试'));
    } finally {
      setQrLoading(false);
    }
  };

  // 新增：检查微信登录状态
  const startCheckWeChatLogin = (ticket) => {
    // 清除之前的定时器
    if (qrCheckTimerRef.current) {
      clearInterval(qrCheckTimerRef.current);
    }

    let checkCount = 0;
    const maxChecks = 60; // 最多检查60次，每次2秒，共2分钟
    
    qrCheckTimerRef.current = setInterval(async () => {
      checkCount++;
      
      if (checkCount > maxChecks) {
        clearInterval(qrCheckTimerRef.current);
        setQrStatus('expired');
        setQrMessage(t('二维码已过期，请刷新'));
        return;
      }

      if (loginProcessed) {
        // 如果已经处理了登录，停止检查
        clearInterval(qrCheckTimerRef.current);
        return;
      }

      try {
        const res = await API.get(`/api/oauth/wechat/qr/login?ticket=${ticket}`);
        const { success, status, message, data } = res.data;
        
        if (success && status === 'success' && !loginProcessed) {
          // 登录成功
          setLoginProcessed(true);
          clearInterval(qrCheckTimerRef.current);
          setQrStatus('success');
          setQrMessage(t('登录成功，正在跳转...'));
          
          // 处理登录
          userDispatch({ type: 'login', payload: data });
          setUserData(data);
          updateAPI();
          showSuccess(t('登录成功！'));
          navigate('/token');
        } else if (status === 'expired') {
          clearInterval(qrCheckTimerRef.current);
          setQrStatus('expired');
          setQrMessage(t('二维码已过期，请刷新'));
        }
        // status === 'waiting' 时继续轮询
      } catch (error) {
        // 忽略轮询错误，继续检查
      }
    }, 2000); // 每2秒检查一次
  };

  // 新增：刷新二维码
  const refreshQRCode = () => {
    setQrCodeData(null);
    getWeChatQRCode();
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (qrCheckTimerRef.current) {
        clearInterval(qrCheckTimerRef.current);
      }
    };
  }, []);

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    setSubmitted(true);
    if (username && password) {
      const res = await API.post(
        `/api/user/login?turnstile=${turnstileToken}`,
        {
          username,
          password,
        },
      );
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        updateAPI();
        showSuccess(t('登录成功！'));
        if (username === 'root' && password === '123456') {
          Modal.error({
            title: t('您正在使用默认密码！'),
            content: t('请立刻修改默认密码！'),
            centered: true,
          });
        }
        navigate('/token');
      } else {
        showError(message);
      }
    } else {
      showError(t('请输入用户名和密码！'));
    }
  }

  const onWeChatLoginClicked = () => {
    setShowWeChatLoginModal(true);
  };

  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
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
      showSuccess(t('登录成功！'));
      setShowWeChatLoginModal(false);
    } else {
      showError(message);
    }
  };

  // 添加Telegram登录处理函数
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
      showSuccess(t('登录成功！'));
      setUserData(data);
      updateAPI();
      navigate('/');
    } else {
      showError(message);
    }
  };

  // 新增：渲染微信扫码登录界面
  const renderQRLogin = () => (
    <div className="qr-login-container">
      <div className="qr-wrapper">
        {qrLoading ? (
          <div className="qr-loading">
            <Spin size="large" />
            <Text type="secondary" style={{ marginTop: 16 }}>
              {t('正在获取二维码...')}
            </Text>
          </div>
        ) : qrCodeData ? (
          <div className="qr-code-wrapper">
            {qrStatus === 'expired' ? (
              <div className="qr-expired-overlay">
                <div className="qr-expired-content">
                  <IconAlarm size="extra-large" />
                  <Text style={{ marginTop: 8 }}>{t('二维码已过期')}</Text>
                  <Button 
                    onClick={refreshQRCode} 
                    style={{ marginTop: 12 }}
                    type="primary"
                  >
                    {t('刷新二维码')}
                  </Button>
                </div>
              </div>
            ) : null}
            <QRCodeSVG 
              value={qrCodeData.qr_url || qrCodeData.url} 
              size={200}
              level="H"
              includeMargin={true}
              className={qrStatus === 'expired' ? 'qr-expired' : ''}
            />
          </div>
        ) : (
          <div className="qr-error">
            <Text type="danger">{t('获取二维码失败')}</Text>
            <Button onClick={getWeChatQRCode} style={{ marginTop: 16 }}>
              {t('重试')}
            </Button>
          </div>
        )}
      </div>

      <div className="qr-info">
        <Title heading={6} style={{ marginBottom: 8, marginTop: 16 }}>
          {t('微信扫码登录')}
        </Title>
        <Text type="secondary" size="small">
          {t('使用微信扫一扫，快速安全登录')}
        </Text>
      </div>

      <div className="qr-status">
        <Text type="secondary" size="small">
          {qrMessage}
        </Text>
      </div>

      <div className="qr-security-notice">
        <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>{t('安全快捷，无需输入密码')}</span>
      </div>
    </div>
  );

  // 新增：处理手机号输入变化
  const handlePhoneChange = (name, value) => {
    setPhoneInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  // 新增：手机号登录
  const handlePhoneLogin = async () => {
    if (!phoneInputs.phone || !phoneInputs.password) {
      showError(t('请输入手机号和密码'));
      return;
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phoneInputs.phone)) {
      showError(t('请输入正确的手机号格式'));
      return;
    }

    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await API.post('/api/user/phone-login', {
        phone: phoneInputs.phone,
        password: phoneInputs.password,
        turnstile: turnstileToken,
      });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        updateAPI();
        showSuccess(t('登录成功！'));
        navigate('/token');
      } else {
        showError(message || t('登录失败'));
      }
    } catch (error) {
      showError(t('网络错误，请稍后重试'));
    } finally {
      setPhoneLoading(false);
    }
  };

  // 新增：渲染手机号登录界面
  const renderPhoneLogin = () => (
    <div className="py-4">
      <Form>
        <Form.Input
          field={'phone'}
          label={t('手机号')}
          placeholder={t('请输入手机号')}
          name='phone'
          value={phoneInputs.phone}
          onChange={(value) => handlePhoneChange('phone', value)}
        />
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--semi-color-text-0)' 
            }}>
              {t('密码')}
            </label>
          </div>
          <Input
            placeholder={t('请输入密码')}
            name='password'
            type={showPhonePassword ? 'text' : 'password'}
            value={phoneInputs.password}
            onChange={(value) => handlePhoneChange('password', value)}
            suffix={
              <Button
                type="tertiary"
                theme="borderless"
                icon={showPhonePassword ? <IconEyeClosed /> : <IconEyeOpened />}
                onClick={() => setShowPhonePassword(!showPhonePassword)}
                style={{ padding: '4px' }}
              />
            }
            style={{ height: '40px' }}
          />
        </div>

        <Button
          theme='solid'
          style={{ width: '100%' }}
          type={'primary'}
          size='large'
          onClick={handlePhoneLogin}
          loading={phoneLoading}
        >
          {t('登录')}
        </Button>
      </Form>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 20,
        }}
      >
        <Text>
          {t('没有账户？')}{' '}
          <Link to='/register?from=phone'>{t('点击注册')}</Link>
        </Text>
        <Text>
          {t('忘记密码？')} <Link to='/reset?from=phone'>{t('点击重置')}</Link>
        </Text>
      </div>
    </div>
  );

  // 新增：渲染密码登录界面
  const renderPasswordLogin = () => (
    <div className="py-4">
      <Form>
        <Form.Input
          field={'username'}
          label={t('用户名/邮箱')}
          placeholder={t('用户名/邮箱')}
          name='username'
          onChange={(value) => handleChange('username', value)}
        />
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--semi-color-text-0)' 
            }}>
              {t('密码')}
            </label>
          </div>
          <Input
            placeholder={t('密码')}
            name='password'
            type={showLoginPassword ? 'text' : 'password'}
            value={password}
            onChange={(value) => handleChange('password', value)}
            suffix={
              <Button
                type="tertiary"
                theme="borderless"
                icon={showLoginPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                style={{ padding: '4px' }}
              />
            }
            style={{ height: '40px' }}
          />
        </div>

        <Button
          theme='solid'
          style={{ width: '100%' }}
          type={'primary'}
          size='large'
          htmlType={'submit'}
          onClick={handleSubmit}
        >
          {t('登录')}
        </Button>
      </Form>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 20,
        }}
      >
        <Text>
          {t('没有账户？')}{' '}
          <Link to='/register?from=email'>{t('点击注册')}</Link>
        </Text>
        <Text>
          {t('忘记密码？')} <Link to='/reset?from=email'>{t('点击重置')}</Link>
        </Text>
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop: '60px' }}>
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
              paddingTop: '0.5rem',
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
                <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 0 }}>
                  <Title 
                    heading={2} 
                    style={{ 
                      marginBottom: 4,
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      marginTop: 0,
                    }}
                    className="login-main-title"
                  >
                    {t('用户登录')}
                  </Title>
                  <Text type="secondary" style={{ fontSize: '0.9rem', opacity: 0.8 }} className="login-subtitle">
                    {t('欢迎回来，选择您喜欢的登录方式')}
                  </Text>
                </div>
                
                {/* Tab切换 */}
                <Tabs 
                  activeKey={activeTabKey} 
                  onChange={setActiveTabKey}
                  centered
                  className="login-tabs"
                  style={{ marginBottom: 8 }}
                >
                  <TabPane 
                    tab={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg className="login-tab-icon" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM8 8h8v2H8V8zm0 3h8v2H8v-2zm0 3h5v2H8v-2z"/>
                        </svg>
                        <span>{t('扫码登录')}</span>
                      </div>
                    } 
                    itemKey="qr"
                  >
                    {renderQRLogin()}
                  </TabPane>
                  <TabPane 
                    tab={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg className="login-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{t('手机登录')}</span>
                      </div>
                    } 
                    itemKey="phone"
                  >
                    {renderPhoneLogin()}
                  </TabPane>
                  <TabPane 
                    tab={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg className="login-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <span>{t('密码登录')}</span>
                      </div>
                    } 
                    itemKey="password"
                  >
                    {renderPasswordLogin()}
                  </TabPane>
                </Tabs>

                {/* 第三方登录保持不变 */}
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
                        gap: '0.5rem',
                        flexWrap: 'wrap',
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
                      {/*{status.wechat_login ? (*/}
                      {/*  <Button*/}
                      {/*    type='primary'*/}
                      {/*    style={{ color: 'rgba(var(--semi-green-5), 1)' }}*/}
                      {/*    icon={<Icon svg={<WeChatIcon />} />}*/}
                      {/*    onClick={onWeChatLoginClicked}*/}
                      {/*  />*/}
                      {/*) : (*/}
                      {/*  <></>*/}
                      {/*)}*/}
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
                
                {/* 微信验证码登录模态框保持不变 */}
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
                      {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
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
                <div>
                  {turnstileEnabled ? (
                    <Turnstile
                      sitekey={turnstileSiteKey}
                      onVerify={(token) => {
                        setTurnstileToken(token);
                      }}
                    />
                  ) : (
                    <></>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default LoginForm;
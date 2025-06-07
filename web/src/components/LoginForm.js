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
} from '../helpers';
import {
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
} from './utils';
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
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import TelegramLoginButton from 'react-telegram-login';

import { IconGithubLogo, IconAlarm } from '@douyinfe/semi-icons';
import OIDCIcon from './OIDCIcon.js';
import WeChatIcon from './WeChatIcon';
import { setUserData } from '../helpers/data.js';
import LinuxDoIcon from './LinuxDoIcon.js';
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

  // 新增：获取微信扫码二维码
  const getWeChatQRCode = async () => {
    setQrLoading(true);
    setLoginProcessed(false); // 重置登录处理标志
    try {
      const res = await API.get('/api/oauth/wechat/qr');
      const { success, data, message } = res.data;
      
      if (success && data) {
        setQrCodeData(data);
        setQrStatus('waiting');
        setQrMessage(t('请使用微信扫码登录'));
        
        // 开始轮询检查登录状态
        startQRLoginCheck(data.ticket);
      } else {
        setQrStatus('error');
        setQrMessage(message || t('获取二维码失败'));
      }
    } catch (error) {
      setQrStatus('error');
      setQrMessage(t('网络错误，请稍后重试'));
    } finally {
      setQrLoading(false);
    }
  };

  // 新增：开始轮询检查扫码状态
  const startQRLoginCheck = (ticket) => {
    if (qrCheckTimerRef.current) {
      clearInterval(qrCheckTimerRef.current);
    }
    
    qrCheckTimerRef.current = setInterval(async () => {
      try {
        const res = await API.get(`/api/oauth/wechat/qr/login?ticket=${ticket}`);
        console.log('扫码检查响应:', res.data); // 添加调试日志
        console.log('响应类型:', typeof res.data);
        console.log('响应字符串:', JSON.stringify(res.data));
        
        // 根据实际返回的数据结构调整解析
        const responseData = res.data;
        
        // 增强判断逻辑，处理可能的响应格式
        const isSuccess = responseData.success && (
          responseData.status === 'success' || 
          responseData.message === '登录成功' ||
          (responseData.data && responseData.data.id && responseData.data.username)
        );
        
        if (isSuccess) {
          // 防止重复处理登录成功
          if (loginProcessed) {
            console.log('登录已处理，跳过重复处理');
            return;
          }
          
          // 登录成功
          console.log('检测到登录成功，清理定时器');
          setLoginProcessed(true); // 标记为已处理
          
          // 立即清理定时器，防止重复触发
          if (qrCheckTimerRef.current) {
            clearInterval(qrCheckTimerRef.current);
            qrCheckTimerRef.current = null;
          }
          
          setQrStatus('success');
          setQrMessage(t('登录成功！'));
          
          // 设置用户数据
          console.log('设置用户数据:', responseData.data);
          userDispatch({ type: 'login', payload: responseData.data });
          setUserData(responseData.data);
          updateAPI();
          
          // 只显示一次成功提示
          showSuccess(t('登录成功！'));
          
          // 延迟1.5秒后跳转，让用户看到成功状态
          setTimeout(() => {
            console.log('准备跳转到/token页面');
            navigate('/token');
          }, 1500);
        } else if (responseData.success === false && responseData.status === 'error') {
          // 明确的错误状态
          clearInterval(qrCheckTimerRef.current);
          setQrStatus('error');
          setQrMessage(responseData.message || t('登录失败'));
          console.log('扫码登录错误:', responseData.message);
        } else if (responseData.status === 'waiting') {
          // 等待扫码状态，继续轮询
          console.log('继续等待扫码...');
        } else if (responseData.success === false && responseData.message && responseData.status !== 'waiting') {
          // 只有在非waiting状态下且有错误消息时才停止轮询
          clearInterval(qrCheckTimerRef.current);
          setQrStatus('error');
          setQrMessage(responseData.message);
          console.log('扫码登录失败:', responseData.message);
        } else {
          // 其他状态，继续轮询
          console.log('未知状态，继续等待:', responseData);
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        setQrStatus('error');
        setQrMessage(t('网络错误，请检查网络连接'));
      }
    }, 2000); // 每2秒检查一次
  };

  // 新增：刷新二维码
  const refreshQRCode = () => {
    if (qrCheckTimerRef.current) clearInterval(qrCheckTimerRef.current);
    setLoginProcessed(false); // 重置登录处理标志
    getWeChatQRCode();
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (qrCheckTimerRef.current) {
        clearInterval(qrCheckTimerRef.current);
        qrCheckTimerRef.current = null;
      }
    };
  }, []);

  // 当切换到扫码登录tab时，自动获取二维码
  useEffect(() => {
    if (activeTabKey === 'qr' && !qrCodeData) {
      getWeChatQRCode();
    }
  }, [activeTabKey]);

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
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
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
        showSuccess('登录成功！');
        if (username === 'root' && password === '123456') {
          Modal.error({
            title: '您正在使用默认密码！',
            content: '请立刻修改默认密码！',
            centered: true,
          });
        }
        navigate('/token');
      } else {
        showError(message);
      }
    } else {
      showError('请输入用户名和密码！');
    }
  }

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
      showSuccess('登录成功！');
      setUserData(data);
      updateAPI();
      navigate('/');
    } else {
      showError(message);
    }
  };

  // 新增：渲染扫码登录界面
  const renderQRLogin = () => (
    <div className="wechat-qr-container">
      <div className="wechat-qr-title">
        <Title level={3} style={{ color: '#09BB07', marginBottom: 8 }}>
          {t('微信扫码登录')}
        </Title>
        <Text type="secondary" className="wechat-qr-subtitle">
          {t('使用微信扫一扫，快速安全登录')}
        </Text>
      </div>

      <div className="qr-code-wrapper">
        {qrLoading ? (
          <div className="qr-code-loading qr-loading-pulse">
            <Spin size="large" />
          </div>
        ) : qrCodeData && qrStatus === 'waiting' ? (
          <div className="qr-code-container waiting">
            <QRCodeSVG
              value={qrCodeData.qr_url}
              size={200}
              level="H"
              includeMargin={true}
              style={{
                background: 'white',
                borderRadius: '8px',
                display: 'block',
                margin: '0 auto',
              }}
            />
          </div>
        ) : qrStatus === 'success' ? (
          <div className="qr-code-success">
            <div className="qr-success-icon" style={{ fontSize: '4rem', color: '#09BB07', marginBottom: '1rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '4rem', height: '4rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <Text strong style={{ color: '#09BB07' }}>
              {t('登录成功！')}
            </Text>
          </div>
        ) : (
          <div className="qr-code-error">
            <div style={{ fontSize: '4rem', color: 'var(--semi-color-text-2)', marginBottom: '1rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '4rem', height: '4rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <Button
              type="primary"
              theme="solid"
              onClick={refreshQRCode}
              className="wechat-refresh-btn"
            >
              {t('重新获取二维码')}
            </Button>
          </div>
        )}
      </div>

      <div className="qr-message">
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
        <Form.Input
          field={'password'}
          label={t('密码')}
          placeholder={t('密码')}
          name='password'
          type='password'
          onChange={(value) => handleChange('password', value)}
        />

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
          <Link to='/register'>{t('点击注册')}</Link>
        </Text>
        <Text>
          {t('忘记密码？')} <Link to='/reset'>{t('点击重置')}</Link>
        </Text>
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
              </Card>
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

export default LoginForm;

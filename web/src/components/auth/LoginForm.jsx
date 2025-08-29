/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../context/User';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  getSystemName,
  setUserData,
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked
} from '../../helpers';
import Turnstile from 'react-turnstile';
import {
  Button,
  Card,
  Divider,
  Form,
  Icon,
  Modal,
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import TelegramLoginButton from 'react-telegram-login';

import { IconGithubLogo, IconMail, IconLock } from '@douyinfe/semi-icons';
import OIDCIcon from '../common/logo/OIDCIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';

const LoginForm = () => {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
  });
  const { username, password } = inputs;
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [userState, userDispatch] = useContext(UserContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatQRData, setWechatQRData] = useState(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [emailLoginLoading, setEmailLoginLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [otherLoginOptionsLoading, setOtherLoginOptionsLoading] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [checkingQRLogin, setCheckingQRLogin] = useState(false);
  const [qrLoginInterval, setQrLoginInterval] = useState(null);

  const logo = getLogo();
  const systemName = getSystemName();

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) {
    localStorage.setItem('aff', affCode);
  }

  const [status, setStatus] = useState({});
  const [statusLoaded, setStatusLoaded] = useState(false);

  // 组件加载时获取系统状态
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await API.get('/api/status');
        if (res.data.success) {
          const statusData = res.data.data;
          setStatus(statusData);
          setStatusLoaded(true);
          localStorage.setItem('status', JSON.stringify(statusData));
          
          // 设置 Turnstile
          if (statusData.turnstile_check) {
            setTurnstileEnabled(true);
            setTurnstileSiteKey(statusData.turnstile_site_key);
          }
        }
      } catch (error) {
        console.error('Failed to load status:', error);
        // 如果加载失败，尝试使用 localStorage 中的缓存
        const cachedStatus = localStorage.getItem('status');
        if (cachedStatus) {
          const statusData = JSON.parse(cachedStatus);
          setStatus(statusData);
          setStatusLoaded(true);
        }
      }
    };
    
    loadStatus();
  }, []);

  useEffect(() => {
    if (searchParams.get('expired')) {
      showError(t('未登录或登录已过期，请重新登录'));
    }
  }, []);

  // 组件加载时，直接获取微信二维码并开始轮询
  useEffect(() => {
    const loadWeChatQRCode = async () => {
      try {
        console.log('正在获取微信二维码...');
        const res = await API.get('/api/oauth/wechat/qr');
        if (res.data.success) {
          console.log('获取二维码成功:', res.data.data);
          setWechatQRData(res.data.data);
          // 自动开始轮询检查登录状态
          startQRLoginCheck(res.data.data.ticket);
        } else {
          console.error('获取二维码失败:', res.data.message);
        }
      } catch (error) {
        console.error('获取微信二维码失败:', error);
      }
    };
    
    // 直接加载二维码，不需要等待或判断
    loadWeChatQRCode();
    
    // 清理函数
    return () => {
      stopQRLoginCheck();
    };
  }, []); // 只在组件挂载时执行一次

  const onWeChatLoginClicked = async () => {
    // 如果已经有二维码数据，直接显示弹窗并开始轮询
    if (wechatQRData && wechatQRData.ticket) {
      setShowWeChatLoginModal(true);
      startQRLoginCheck(wechatQRData.ticket);
      return;
    }
    
    // 没有二维码数据，需要获取
    setWechatLoading(true);
    try {
      // 动态获取二维码
      const res = await API.get('/api/oauth/wechat/qr');
      if (res.data.success) {
        setWechatQRData(res.data.data);
        setShowWeChatLoginModal(true);
        // 开始轮询检查登录状态
        startQRLoginCheck(res.data.data.ticket);
      } else {
        showError(res.data.message || '获取二维码失败');
      }
    } catch (error) {
      showError('获取微信二维码失败，请稍后重试');
    } finally {
      setWechatLoading(false);
    }
  };

  // 开始轮询检查二维码登录状态
  const startQRLoginCheck = (ticket) => {
    if (qrLoginInterval) {
      clearInterval(qrLoginInterval);
    }
    
    setCheckingQRLogin(true);
    const interval = setInterval(async () => {
      try {
        const res = await API.get(`/api/oauth/wechat/qr/login?ticket=${ticket}`);
        if (res.data.success && res.data.status === 'success') {
          // 登录成功
          clearInterval(interval);
          setCheckingQRLogin(false);
          userDispatch({ type: 'login', payload: res.data.data });
          localStorage.setItem('user', JSON.stringify(res.data.data));
          setUserData(res.data.data);
          updateAPI();
          navigate('/console/token');
          showSuccess('登录成功！');
          setShowWeChatLoginModal(false);
        } else if (res.data.status === 'error') {
          // 出错了
          clearInterval(interval);
          setCheckingQRLogin(false);
          showError(res.data.message || '登录失败');
        }
        // status === 'waiting' 时继续轮询
      } catch (error) {
        console.error('检查登录状态失败:', error);
      }
    }, 2000); // 每2秒检查一次
    
    setQrLoginInterval(interval);
  };

  // 清理轮询
  const stopQRLoginCheck = () => {
    if (qrLoginInterval) {
      clearInterval(qrLoginInterval);
      setQrLoginInterval(null);
    }
    setCheckingQRLogin(false);
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (qrLoginInterval) {
        clearInterval(qrLoginInterval);
      }
    };
  }, [qrLoginInterval]);

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setSubmitted(true);
    setLoginLoading(true);
    try {
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
          // 检查是否需要2FA验证
          if (data && data.require_2fa) {
            setShowTwoFA(true);
            setLoginLoading(false);
            return;
          }

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
          navigate('/console/token');
        } else {
          showError(message);
        }
      } else {
        showError('请输入用户名和密码！');
      }
    } catch (error) {
      showError('登录失败，请重试');
    } finally {
      setLoginLoading(false);
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
    try {
      const res = await API.get(`/api/oauth/telegram/login`, { params });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        showSuccess('登录成功！');
        setUserData(data);
        updateAPI();
        navigate('/console/token');
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
    }
  };

  // 包装的GitHub登录点击处理
  const handleGitHubClick = () => {
    setGithubLoading(true);
    try {
      onGitHubOAuthClicked(status.github_client_id);
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setGithubLoading(false), 3000);
    }
  };

  // 包装的OIDC登录点击处理
  const handleOIDCClick = () => {
    setOidcLoading(true);
    try {
      onOIDCClicked(
        status.oidc_authorization_endpoint,
        status.oidc_client_id
      );
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setOidcLoading(false), 3000);
    }
  };

  // 包装的LinuxDO登录点击处理
  const handleLinuxDOClick = () => {
    setLinuxdoLoading(true);
    try {
      onLinuxDOOAuthClicked(status.linuxdo_client_id);
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setLinuxdoLoading(false), 3000);
    }
  };

  // 包装的邮箱登录选项点击处理
  const handleEmailLoginClick = () => {
    setEmailLoginLoading(true);
    setShowEmailLogin(true);
    setEmailLoginLoading(false);
  };

  // 包装的重置密码点击处理
  const handleResetPasswordClick = () => {
    setResetPasswordLoading(true);
    navigate('/reset');
    setResetPasswordLoading(false);
  };

  // 包装的其他登录选项点击处理
  const handleOtherLoginOptionsClick = () => {
    setOtherLoginOptionsLoading(true);
    setShowEmailLogin(false);
    setOtherLoginOptionsLoading(false);
  };

  // 2FA验证成功处理
  const handle2FASuccess = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    showSuccess('登录成功！');
    navigate('/console/token');
  };

  // 返回登录页面
  const handleBackToLogin = () => {
    setShowTwoFA(false);
    setInputs({ username: '', password: '' });
  };

  const renderOAuthOptions = () => {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-6 gap-2">
            <img src={logo} alt="Logo" className="h-10 rounded-full" />
            <Title heading={3} className='!text-gray-800'>{systemName}</Title>
          </div>

          <Card className="border-0 !rounded-2xl overflow-hidden">
            <div className="flex justify-center pt-6 pb-2">
              <Title heading={3} className="text-gray-800 dark:text-gray-200">{t('登 录')}</Title>
            </div>
            <div className="px-2 py-8">
<<<<<<< HEAD:web/src/components/auth/LoginForm.js
              {/* 直接显示微信二维码 */}
              <div className="mb-6">
                <div className="flex flex-col items-center">
                  {wechatQRData && wechatQRData.qr_url ? (
                    <>
                      <img src={wechatQRData.qr_url} alt="微信二维码" className="w-48 h-48 mb-4" />
                      <div className="text-center">
                        {checkingQRLogin ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                            <Text type="tertiary">{t('等待扫码中...')}</Text>
                          </div>
                        ) : (
                          <Text type="tertiary">{t('请使用微信扫描二维码登录')}</Text>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <Text type="tertiary">{t('加载二维码中...')}</Text>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 分隔线 */}
                {(status.github_oauth || status.oidc_enabled || status.linuxdo_oauth || status.telegram_oauth) && (
                  <Divider margin='20px' align='center'>
                    {t('或使用其他方式登录')}
                  </Divider>
=======
              <div className="space-y-3">
                {status.wechat_login && (
                  <Button
                    theme='outline'
                    className="w-full h-12 flex items-center justify-center !rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                    type="tertiary"
                    icon={<Icon svg={<WeChatIcon />} style={{ color: '#07C160' }} />}
                    onClick={onWeChatLoginClicked}
                    loading={wechatLoading}
                  >
                    <span className="ml-3">{t('使用 微信 继续')}</span>
                  </Button>
>>>>>>> alpha:web/src/components/auth/LoginForm.jsx
                )}
              </div>

              {/* 其他OAuth选项按钮 */}
              <div className="space-y-3">
                {status.github_oauth && (
                  <Button
                    theme='outline'
                    className="w-full h-12 flex items-center justify-center !rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                    type="tertiary"
                    icon={<IconGithubLogo size="large" />}
                    onClick={handleGitHubClick}
                    loading={githubLoading}
                  >
                    <span className="ml-3">{t('使用 GitHub 继续')}</span>
                  </Button>
                )}

                {status.oidc_enabled && (
                  <Button
                    theme='outline'
                    className="w-full h-12 flex items-center justify-center !rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                    type="tertiary"
                    icon={<OIDCIcon style={{ color: '#1877F2' }} />}
                    onClick={handleOIDCClick}
                    loading={oidcLoading}
                  >
                    <span className="ml-3">{t('使用 OIDC 继续')}</span>
                  </Button>
                )}

                {status.linuxdo_oauth && (
                  <Button
                    theme='outline'
                    className="w-full h-12 flex items-center justify-center !rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                    type="tertiary"
                    icon={<LinuxDoIcon style={{ color: '#E95420', width: '20px', height: '20px' }} />}
                    onClick={handleLinuxDOClick}
                    loading={linuxdoLoading}
                  >
                    <span className="ml-3">{t('使用 LinuxDO 继续')}</span>
                  </Button>
                )}

                {status.telegram_oauth && (
                  <div className="flex justify-center my-2">
                    <TelegramLoginButton
                      dataOnauth={onTelegramLoginClicked}
                      botName={status.telegram_bot_name}
                    />
                  </div>
                )}
<<<<<<< HEAD:web/src/components/auth/LoginForm.js
=======

                <Divider margin='12px' align='center'>
                  {t('或')}
                </Divider>

                <Button
                  theme="solid"
                  type="primary"
                  className="w-full h-12 flex items-center justify-center bg-black text-white !rounded-full hover:bg-gray-800 transition-colors"
                  icon={<IconMail size="large" />}
                  onClick={handleEmailLoginClick}
                  loading={emailLoginLoading}
                >
                  <span className="ml-3">{t('使用 邮箱或用户名 登录')}</span>
                </Button>
>>>>>>> alpha:web/src/components/auth/LoginForm.jsx
              </div>

              <Divider margin='12px' align='center'>
                {t('或')}
              </Divider>

              <Button
                theme="solid"
                type="primary"
                className="w-full h-12 flex items-center justify-center bg-black text-white !rounded-full hover:bg-gray-800 transition-colors"
                icon={<IconMail size="large" />}
                size="large"
                onClick={handleEmailLoginClick}
                loading={emailLoginLoading}
              >
                <span className="ml-3">{t('使用 邮箱或用户名 登录')}</span>
              </Button>
            </div>

            {!status.self_use_mode_enabled && (
              <div className="mt-6 text-center text-sm">
                <Text>
                  {t('没有账户？')}
                </Text>
                <div style={{ marginTop: '8px' }}>
                  <Button
                    theme="solid"
                    type="primary"
                    size="small"
                    onClick={() => navigate('/register')}
                  >
                    {t('点击注册')}
                  </Button>
                </div>
              </div>
            )}
          </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderEmailLoginForm = () => {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-6 gap-2">
            <img src={logo} alt="Logo" className="h-10 rounded-full" />
            <Title heading={3}>{systemName}</Title>
          </div>

          <Card className="border-0 !rounded-2xl overflow-hidden">
            <div className="flex justify-center pt-6 pb-2">
              <Title heading={3} className="text-gray-800 dark:text-gray-200">{t('登 录')}</Title>
            </div>
            <div className="px-2 py-8">
              <Form className="space-y-3">
                <Form.Input
                  field="username"
                  label={t('用户名或邮箱')}
                  placeholder={t('请输入您的用户名或邮箱地址')}
                  name="username"
                  onChange={(value) => handleChange('username', value)}
                  prefix={<IconMail />}
                />

                <Form.Input
                  field="password"
                  label={t('密码')}
                  placeholder={t('请输入您的密码')}
                  name="password"
                  mode="password"
                  onChange={(value) => handleChange('password', value)}
                  prefix={<IconLock />}
                />

                <div className="space-y-2 pt-2">
                  <Button
                    theme="solid"
                    className="w-full !rounded-full"
                    type="primary"
                    htmlType="submit"
                    onClick={handleSubmit}
                    loading={loginLoading}
                  >
                    {t('继续')}
                  </Button>

<<<<<<< HEAD:web/src/components/auth/LoginForm.js
                  <div className="text-center mt-3">
                    <Text type="tertiary">
                      {t('忘记密码？')}
                    </Text>
                    <div style={{ marginTop: '8px' }}>
                      <Button
                        theme="solid"
                        type="primary"
                        size="small"
                        onClick={handleResetPasswordClick}
                      >
                        {t('点击重置')}
                      </Button>
                    </div>
                  </div>
=======
                  <Button
                    theme="borderless"
                    type='tertiary'
                    className="w-full !rounded-full"
                    onClick={handleResetPasswordClick}
                    loading={resetPasswordLoading}
                  >
                    {t('忘记密码？')}
                  </Button>
>>>>>>> alpha:web/src/components/auth/LoginForm.jsx
                </div>
              </Form>

              {(status.github_oauth || status.oidc_enabled || status.wechat_login || status.linuxdo_oauth || status.telegram_oauth) && (
                <>
                  <Divider margin='12px' align='center'>
                    {t('或')}
                  </Divider>

                  <div className="mt-4 text-center">
                    <Button
                      theme="outline"
                      type="tertiary"
                      className="w-full !rounded-full"
                      onClick={handleOtherLoginOptionsClick}
                      loading={otherLoginOptionsLoading}
                    >
                      {t('其他登录选项')}
                    </Button>
                  </div>
                </>
              )}

              {!status.self_use_mode_enabled && (
                <div className="mt-6 text-center text-sm">
                  <Text>
                    {t('没有账户？')}
                  </Text>
                  <div style={{ marginTop: '8px' }}>
                    <Button
                      theme="solid"
                      type="primary"
                      size="small"
                      onClick={() => navigate('/register')}
                    >
                      {t('点击注册')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // 微信登录模态框
  const renderWeChatLoginModal = () => {
    return (
      <Modal
        title={t('微信扫码登录')}
        visible={showWeChatLoginModal}
        maskClosable={true}
<<<<<<< HEAD:web/src/components/auth/LoginForm.js
        onCancel={() => {
          setShowWeChatLoginModal(false);
          stopQRLoginCheck();
          // 关闭弹窗时清除二维码数据，下次打开时重新获取
          setTimeout(() => {
            setWechatQRData(null);
          }, 300); // 延迟清除，避免关闭动画时闪烁
        }}
        footer={null}
        size="small"
=======
        onOk={onSubmitWeChatVerificationCode}
        onCancel={() => setShowWeChatLoginModal(false)}
        okText={t('登录')}
>>>>>>> alpha:web/src/components/auth/LoginForm.jsx
        centered={true}
      >
        <div className="flex flex-col items-center">
          {wechatQRData && wechatQRData.qr_url ? (
            <img src={wechatQRData.qr_url} alt="微信二维码" className="mb-4 w-64 h-64" />
          ) : (
            <div className="mb-4 w-64 h-64 flex items-center justify-center bg-gray-100">
              <Text type="tertiary">加载二维码中...</Text>
            </div>
          )}
        </div>

        <div className="text-center mb-4">
          {checkingQRLogin ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <Text>{t('等待扫码中...')}</Text>
            </div>
          ) : (
            <p>{t('请使用微信扫描二维码登录')}</p>
          )}
        </div>
<<<<<<< HEAD:web/src/components/auth/LoginForm.js
=======

        <Form>
          <Form.Input
            field="wechat_verification_code"
            placeholder={t('验证码')}
            label={t('验证码')}
            value={inputs.wechat_verification_code}
            onChange={(value) => handleChange('wechat_verification_code', value)}
          />
        </Form>
>>>>>>> alpha:web/src/components/auth/LoginForm.jsx
      </Modal>
    );
  };

  // 2FA验证弹窗
  const render2FAModal = () => {
    return (
      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM8 7a1 1 0 100 2h8a1 1 0 100-2H8zM6 14a2 2 0 11-4 0 2 2 0 014 0zM8 13a1 1 0 100 2h8a1 1 0 100-2H8z" clipRule="evenodd" />
              </svg>
            </div>
            两步验证
          </div>
        }
        visible={showTwoFA}
        onCancel={handleBackToLogin}
        footer={null}
        width={450}
        centered
      >
        <TwoFAVerification
          onSuccess={handle2FASuccess}
          onBack={handleBackToLogin}
          isModal={true}
        />
      </Modal>
    );
  };

  return (
    <div className="relative overflow-hidden bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* 背景模糊晕染球 */}
      <div className="blur-ball blur-ball-indigo" style={{ top: '-80px', right: '-80px', transform: 'none' }} />
      <div className="blur-ball blur-ball-teal" style={{ top: '50%', left: '-120px' }} />
      <div className="w-full max-w-sm mt-[60px]">
        {showEmailLogin || !(status.github_oauth || status.oidc_enabled || status.wechat_login || status.linuxdo_oauth || status.telegram_oauth)
          ? renderEmailLoginForm()
          : renderOAuthOptions()}
        {renderWeChatLoginModal()}
        {render2FAModal()}

        {turnstileEnabled && (
          <div className="flex justify-center mt-6">
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
  );
};

export default LoginForm;

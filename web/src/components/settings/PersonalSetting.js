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
import { useNavigate } from 'react-router-dom';
import {
  API,
  copy,
  isRoot,
  isAdmin,
  showError,
  showInfo,
  showSuccess,
  renderQuota,
  renderQuotaWithPrompt,
  stringToColor,
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  renderModelTag,
  getModelCategories
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { UserContext } from '../../context/User';
import { useTheme } from '../../context/Theme';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Empty,
  Image,
  Input,
  Layout,
  Modal,
  Skeleton,
  Space,
  Tag,
  Typography,
  Collapsible,
  Radio,
  RadioGroup,
  AutoComplete,
  Checkbox,
  Tabs,
  TabPane
} from '@douyinfe/semi-ui';
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations';
import {
  IconMail,
  IconLock,
  IconShield,
  IconUser,
  IconSetting,
  IconBell,
  IconGithubLogo,
  IconKey,
  IconDelete,
  IconChevronDown,
  IconChevronUp
} from '@douyinfe/semi-icons';
import { SiTelegram, SiWechat, SiLinux } from 'react-icons/si';
import { Bell, Shield, Webhook, Globe, Settings, UserPlus, ShieldCheck } from 'lucide-react';
import TelegramLoginButton from 'react-telegram-login';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import ImageCaptcha from '../ImageCaptcha';

const PersonalSetting = () => {
  const [userState, userDispatch] = useContext(UserContext);
  let navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();

  const [inputs, setInputs] = useState({
    wechat_verification_code: '',
    email_verification_code: '',
    email: '',
    phone: '',
    phone_verification_code: '',
    self_account_deletion_confirmation: '',
    original_password: '',
    set_new_password: '',
    set_new_password_confirmation: '',
  });
  const [status, setStatus] = useState({});
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showWeChatBindModal, setShowWeChatBindModal] = useState(false);
  const [showEmailBindModal, setShowEmailBindModal] = useState(false);
  const [showPhoneBindModal, setShowPhoneBindModal] = useState(false);
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [phoneDisableButton, setPhoneDisableButton] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(60);
  const [systemToken, setSystemToken] = useState('');
  const [models, setModels] = useState([]);
  const [isModelsExpanded, setIsModelsExpanded] = useState(() => {
    // Initialize from localStorage if available
    const savedState = localStorage.getItem('modelsExpanded');
    return savedState ? JSON.parse(savedState) : false;
  });
  const [activeModelCategory, setActiveModelCategory] = useState('all');
  const MODELS_DISPLAY_COUNT = 25; // 默认显示的模型数量
  const [notificationSettings, setNotificationSettings] = useState({
    warningType: 'email',
    warningThreshold: 100000,
    webhookUrl: '',
    webhookSecret: '',
    notificationEmail: '',
    acceptUnsetModelRatioModel: false,
    recordIpLog: false,
  });
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showWebhookDocs, setShowWebhookDocs] = useState(true);
  
  // 微信二维码绑定相关状态
  const [wechatQRCode, setWechatQRCode] = useState('');
  const [wechatTicket, setWechatTicket] = useState('');
  const [isCheckingWechatLogin, setIsCheckingWechatLogin] = useState(false);
  const [wechatBindStatus, setWechatBindStatus] = useState('waiting'); // waiting, success, error
  const [wechatBindError, setWechatBindError] = useState('');
  
  // 图片验证码相关状态
  const [showPhoneImageCaptcha, setShowPhoneImageCaptcha] = useState(false);
  const [imageCaptchaData, setImageCaptchaData] = useState(null);
  const [showEmailImageCaptcha, setShowEmailImageCaptcha] = useState(false);
  const [emailImageCaptchaData, setEmailImageCaptchaData] = useState(null);

  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      setStatus(status);
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
    getUserData().then((res) => {
      console.log(userState);
    });
    loadModels().then();
  }, []);

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
    return () => clearInterval(countdownInterval); // Clean up on unmount
  }, [disableButton, countdown]);

  useEffect(() => {
    let phoneCountdownInterval = null;
    if (phoneDisableButton && phoneCountdown > 0) {
      phoneCountdownInterval = setInterval(() => {
        setPhoneCountdown(phoneCountdown - 1);
      }, 1000);
    } else if (phoneCountdown === 0) {
      setPhoneDisableButton(false);
      setPhoneCountdown(60);
    }
    return () => clearInterval(phoneCountdownInterval);
  }, [phoneDisableButton, phoneCountdown]);

  useEffect(() => {
    if (userState?.user?.setting) {
      const settings = JSON.parse(userState.user.setting);
      setNotificationSettings({
        warningType: settings.notify_type || 'email',
        warningThreshold: settings.quota_warning_threshold || 500000,
        webhookUrl: settings.webhook_url || '',
        webhookSecret: settings.webhook_secret || '',
        notificationEmail: settings.notification_email || '',
        acceptUnsetModelRatioModel:
          settings.accept_unset_model_ratio_model || false,
        recordIpLog: settings.record_ip_log || false,
      });
    }
  }, [userState?.user?.setting]);

  // Save models expanded state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('modelsExpanded', JSON.stringify(isModelsExpanded));
  }, [isModelsExpanded]);

  const handleInputChange = (name, value) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const generateAccessToken = async () => {
    const res = await API.get('/api/user/token');
    const { success, message, data } = res.data;
    if (success) {
      setSystemToken(data);
      await copy(data);
      showSuccess(t('令牌已重置并已复制到剪贴板'));
    } else {
      showError(message);
    }
  };

  const getUserData = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  const loadModels = async () => {
    setModelsLoading(true);

    try {
      let res = await API.get(`/api/user/models`);
      const { success, message, data } = res.data;

      if (success) {
        if (data != null) {
          setModels(data);
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('加载模型列表失败'));
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSystemTokenClick = async (e) => {
    e.target.select();
    await copy(e.target.value);
    showSuccess(t('系统令牌已复制到剪切板'));
  };

  const deleteAccount = async () => {
    if (inputs.self_account_deletion_confirmation !== userState.user.username) {
      showError(t('请输入你的账户名以确认删除！'));
      return;
    }

    const res = await API.delete('/api/user/self');
    const { success, message } = res.data;

    if (success) {
      showSuccess(t('账户已删除！'));
      await API.get('/api/user/logout');
      userDispatch({ type: 'logout' });
      localStorage.removeItem('user');
      navigate('/login');
    } else {
      showError(message);
    }
  };

  // 获取微信二维码
  const getWeChatQRCode = async () => {
    try {
      console.log('开始获取微信二维码...');
      const res = await API.get('/api/oauth/wechat/qr');
      console.log('API响应:', res);
      const { success, data, message } = res.data;
      
      if (success && data) {
        console.log('二维码数据:', data);
        setWechatQRCode(data.qr_url || data.url);
        setWechatTicket(data.ticket);
        setWechatBindStatus('waiting');
        startCheckWeChatLogin(data.ticket);
      } else {
        console.error('获取二维码失败:', message);
        showError(message || t('获取二维码失败'));
        setWechatBindStatus('error');
      }
    } catch (error) {
      console.error('API调用失败:', error);
      showError(t('获取二维码失败') + ': ' + error.message);
      setWechatBindStatus('error');
    }
  };

  // 开始检查微信扫码状态
  const startCheckWeChatLogin = (ticket) => {
    setIsCheckingWechatLogin(true);
    setWechatBindError(''); // 清除之前的错误信息
    let checkCount = 0;
    const maxChecks = 15; // 30秒 / 2秒 = 15次检查
    let isActive = true; // 用来控制轮询是否继续
    
    const checkInterval = setInterval(async () => {
      if (!isActive) {
        clearInterval(checkInterval);
        return;
      }
      
      checkCount++;
      
      try {
        const res = await API.get(`/api/oauth/wechat/qr/bind?ticket=${ticket}`);
        console.log('微信绑定检查响应:', res.data);
        const { success, status, message, data } = res.data;
        
        if (success && status === 'success') {
          // 扫码绑定成功
          isActive = false; // 立即停止轮询
          clearInterval(checkInterval);
          setIsCheckingWechatLogin(false);
          setWechatBindStatus('success');
          setShowWeChatBindModal(false);
          
          // 根据操作类型显示不同的成功消息
          if (data && data.action === 'merged') {
            showSuccess(
              t('微信账号合并成功！') + '\n' +
              t('合并账号') + ': ' + data.wechat_username + '\n' +
              t('合并余额') + ': ' + renderQuota(data.merged_quota) + '\n' +
              t('合并历史消耗') + ': ' + renderQuota(data.merged_used_quota) + '\n' +
              t('合并请求次数') + ': ' + data.merged_request_count
            );
          } else if (data && data.action === 'already_bound') {
            showSuccess(message || t('微信已绑定'));
          } else {
            showSuccess(message || t('微信绑定成功'));
          }
          
          getUserData(); // 刷新用户数据
        } else if (status === 'waiting') {
          // 等待扫码，继续轮询，不做任何操作
          console.log('等待用户扫码...');
        } else if (status === 'expired') {
          // 二维码过期
          isActive = false;
          clearInterval(checkInterval);
          setIsCheckingWechatLogin(false);
          setWechatBindStatus('expired');
          setWechatBindError(t('二维码已过期，请重新获取'));
        } else if (status === 'error') {
          // 绑定失败
          isActive = false;
          clearInterval(checkInterval);
          setIsCheckingWechatLogin(false);
          setWechatBindStatus('error');
          setWechatBindError(message || t('绑定失败'));
        }
      } catch (error) {
        console.log('检查微信绑定状态时出错:', error);
        // 不要在这里停止轮询，因为可能只是暂时的网络问题
      }
      
      // 达到最大检查次数，停止轮询
      if (checkCount >= maxChecks) {
        isActive = false;
        clearInterval(checkInterval);
        setIsCheckingWechatLogin(false);
        if (wechatBindStatus === 'waiting') {
          setWechatBindStatus('expired');
          setWechatBindError(t('扫码超时，请重新获取二维码'));
        }
      }
    }, 2000); // 每2秒检查一次
    
    // 确保在组件卸载时清理定时器
    return () => {
      isActive = false;
      clearInterval(checkInterval);
    };
  };

  // 处理微信绑定弹窗打开
  const handleWeChatBindClick = () => {
    setShowWeChatBindModal(true);
    setWechatBindStatus('waiting');
    setWechatQRCode('');
    setWechatTicket('');
    setWechatBindError('');
    setIsCheckingWechatLogin(false);
    getWeChatQRCode();
  };

  const changePassword = async () => {
    if (inputs.original_password === '') {
      showError(t('请输入原密码！'));
      return;
    }
    if (inputs.set_new_password === '') {
      showError(t('请输入新密码！'));
      return;
    }
    if (inputs.original_password === inputs.set_new_password) {
      showError(t('新密码需要和原密码不一致！'));
      return;
    }
    if (inputs.set_new_password !== inputs.set_new_password_confirmation) {
      showError(t('两次输入的密码不一致！'));
      return;
    }
    const res = await API.put(`/api/user/self`, {
      original_password: inputs.original_password,
      password: inputs.set_new_password,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('密码修改成功！'));
      setShowWeChatBindModal(false);
    } else {
      showError(message);
    }
    setShowChangePasswordModal(false);
  };

  // 处理手机号绑定的图片验证码验证成功
  const handlePhoneImageCaptchaVerified = (captchaData) => {
    setImageCaptchaData(captchaData);
    setShowPhoneImageCaptcha(false);
    // 验证成功后自动发送手机验证码
    sendPhoneVerificationAfterCaptcha(captchaData);
  };

  // 手机号绑定的图片验证码验证失败或错误
  const handlePhoneImageCaptchaError = (error) => {
    console.error('手机号绑定图片验证码错误:', error);
    setImageCaptchaData(null);
    // 重新显示验证码
    setShowPhoneImageCaptcha(true);
  };

  // 发送手机验证码（在图片验证码验证成功后）
  const sendPhoneVerificationAfterCaptcha = async (captchaData) => {
    if (inputs.phone === '') return;
    
    setLoading(true);
    try {
      // 注意：后端需要实现 /api/verification/phone 接口
      // 目前后端有 SendPhoneVerification 函数但未注册路由
      // 需要在 router/api-router.go 中添加:
      // apiRouter.POST("/verification/phone", controller.SendPhoneVerification)
      const res = await API.post('/api/verification/phone', {
        phone: inputs.phone,
        purpose: 'bind',
        image_captcha_id: captchaData.captcha_id,
        image_captcha_code: captchaData.captcha_code,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('验证码发送成功，请检查手机！'));
        setPhoneCountdown(60);
        setPhoneDisableButton(true);
      } else {
        showError(message);
        // 如果发送失败，提示用户重新验证
        if (message.includes('图片验证码') || message.includes('验证码错误') || message.includes('已过期')) {
          showInfo(t('请重新完成图片验证码验证'));
          setImageCaptchaData(null);
          setShowPhoneImageCaptcha(true);
        }
      }
    } catch (error) {
      // 如果接口不存在，提示用户
      if (error.response && error.response.status === 404) {
        showError(t('手机验证功能暂未开放，请联系管理员'));
      } else {
        showError(t('发送验证码失败，请重试'));
      }
      // 网络错误时也提示重新验证
      setImageCaptchaData(null);
      setShowPhoneImageCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  // 发送手机验证码
  const sendPhoneVerificationCode = async () => {
    if (inputs.phone === '') {
      showError(t('请输入手机号！'));
      return;
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(inputs.phone)) {
      showError(t('请输入正确的手机号格式'));
      return;
    }
    
    // 在手机号绑定模态框内显示图片验证码
    setShowPhoneImageCaptcha(true);
  };

  // 绑定手机号
  const bindPhone = async () => {
    if (inputs.phone_verification_code === '') {
      showError(t('请输入手机验证码！'));
      return;
    }
    setLoading(true);
    
    try {
      // 注意：后端需要实现 /api/oauth/phone/bind 接口
      // 需要创建 PhoneBind 函数并在路由中注册
      const res = await API.post('/api/oauth/phone/bind', {
        phone: inputs.phone,
        code: inputs.phone_verification_code,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('手机号绑定成功！'));
        setShowPhoneBindModal(false);
        setShowPhoneImageCaptcha(false);
        setImageCaptchaData(null);
        // 重置输入
        setInputs(prev => ({
          ...prev,
          phone: '',
          phone_verification_code: ''
        }));
        if (userState.user) {
          userState.user.phone = inputs.phone;
        }
        getUserData(); // 刷新用户数据
      } else {
        showError(message);
      }
    } catch (error) {
      // 如果接口不存在，提示用户
      if (error.response && error.response.status === 404) {
        showError(t('手机绑定功能暂未开放，请联系管理员'));
      } else {
        showError(t('绑定失败，请重试'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理邮箱绑定的图片验证码验证成功
  const handleEmailImageCaptchaVerified = (captchaData) => {
    setEmailImageCaptchaData(captchaData);
    setShowEmailImageCaptcha(false);
    // 验证成功后自动发送邮箱验证码
    sendEmailVerificationAfterCaptcha(captchaData);
  };

  // 邮箱绑定的图片验证码验证失败或错误
  const handleEmailImageCaptchaError = (error) => {
    console.error('邮箱绑定图片验证码错误:', error);
    setEmailImageCaptchaData(null);
    // 重新显示验证码
    setShowEmailImageCaptcha(true);
  };

  // 发送邮箱验证码（在图片验证码验证成功后）
  const sendEmailVerificationAfterCaptcha = async (captchaData) => {
    if (inputs.email === '') return;
    
    setLoading(true);
    setDisableButton(true);
    try {
      const res = await API.get(
        `/api/verification?email=${inputs.email}&turnstile=${turnstileToken}&image_captcha_id=${captchaData.captcha_id}&image_captcha_code=${captchaData.captcha_code}`,
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('验证码发送成功，请检查邮箱！'));
        setCountdown(30);
      } else {
        showError(message);
        // 如果发送失败，提示用户重新验证
        if (message.includes('图片验证码') || message.includes('验证码错误') || message.includes('已过期')) {
          showInfo(t('请重新完成图片验证码验证'));
          setEmailImageCaptchaData(null);
          setShowEmailImageCaptcha(true);
        }
        setDisableButton(false);
      }
    } catch (error) {
      showError(t('发送验证码失败，请重试'));
      // 网络错误时也提示重新验证
      setEmailImageCaptchaData(null);
      setShowEmailImageCaptcha(true);
      setDisableButton(false);
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    if (inputs.email === '') {
      showError(t('请输入邮箱！'));
      return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inputs.email)) {
      showError(t('请输入正确的邮箱格式'));
      return;
    }
    
    // 显示图片验证码
    setShowEmailImageCaptcha(true);
  };

  const bindEmail = async () => {
    if (inputs.email_verification_code === '') {
      showError(t('请输入邮箱验证码！'));
      return;
    }
    setLoading(true);
    const res = await API.get(
      `/api/oauth/email/bind?email=${inputs.email}&code=${inputs.email_verification_code}`,
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('邮箱账户绑定成功！'));
      setShowEmailBindModal(false);
      setShowEmailImageCaptcha(false);
      setEmailImageCaptchaData(null);
      // 重置输入
      setInputs(prev => ({
        ...prev,
        email: '',
        email_verification_code: ''
      }));
      userState.user.email = inputs.email;
      getUserData(); // 刷新用户数据
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const getUsername = () => {
    if (userState.user) {
      return userState.user.username;
    } else {
      return 'null';
    }
  };

  const getAvatarText = () => {
    const username = getUsername();
    if (username && username.length > 0) {
      // 获取前两个字符，支持中文和英文
      return username.slice(0, 2).toUpperCase();
    }
    return 'NA';
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      // setSearchKeyword(text);
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  const handleNotificationSettingChange = (type, value) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [type]: value.target ? value.target.value !== undefined ? value.target.value : value.target.checked : value, // handle checkbox properly
    }));
  };

  const saveNotificationSettings = async () => {
    try {
      const res = await API.put('/api/user/setting', {
        notify_type: notificationSettings.warningType,
        quota_warning_threshold: parseFloat(
          notificationSettings.warningThreshold,
        ),
        webhook_url: notificationSettings.webhookUrl,
        webhook_secret: notificationSettings.webhookSecret,
        notification_email: notificationSettings.notificationEmail,
        accept_unset_model_ratio_model:
          notificationSettings.acceptUnsetModelRatioModel,
        record_ip_log: notificationSettings.recordIpLog,
      });

      if (res.data.success) {
        showSuccess(t('设置保存成功'));
        await getUserData();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('设置保存失败'));
    }
  };

  return (
    <div className="bg-gray-50 mt-[60px]">
      <div className="flex justify-center">
        <div className="w-full">
          {/* 主卡片容器 */}
          <Card className="!rounded-2xl shadow-lg border-0">
            {/* 顶部用户信息区域 */}
            <Card
              className="!rounded-2xl !border-0 !shadow-lg overflow-hidden"
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)'
                  : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
                position: 'relative'
              }}
              bodyStyle={{ padding: 0 }}
            >
              {/* 装饰性背景元素 */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-slate-400 dark:bg-slate-500 opacity-5 rounded-full"></div>
                <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-slate-300 dark:bg-slate-400 opacity-8 rounded-full"></div>
                <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-slate-400 dark:bg-slate-500 opacity-6 rounded-full"></div>
              </div>

              <div className="relative p-4 sm:p-6 md:p-8 text-gray-600 dark:text-gray-300">
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                  <div className="flex items-center flex-1 min-w-0">
                    <Avatar
                      size='large'
                      className="mr-3 sm:mr-4 shadow-md flex-shrink-0 bg-slate-500 dark:bg-slate-400"
                    >
                      {getAvatarText()}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-base sm:text-lg font-semibold truncate text-gray-800 dark:text-gray-100">
                        {getUsername()}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 sm:gap-2">
                        {isRoot() ? (
                          <Tag
                            size='small'
                            className="!rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            style={{ fontWeight: '500' }}
                          >
                            {t('超级管理员')}
                          </Tag>
                        ) : isAdmin() ? (
                          <Tag
                            size='small'
                            className="!rounded-full bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            style={{ fontWeight: '500' }}
                          >
                            {t('管理员')}
                          </Tag>
                        ) : (
                          <Tag
                            size='small'
                            className="!rounded-full bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            style={{ fontWeight: '500' }}
                          >
                            {t('普通用户')}
                          </Tag>
                        )}
                        <Tag
                          size='small'
                          className="!rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          style={{ fontWeight: '500' }}
                        >
                          ID: {userState?.user?.id}
                        </Tag>
                      </div>
                    </div>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shadow-md flex-shrink-0 ml-2 bg-slate-400 dark:bg-slate-500">
                    <IconUser size="default" className="text-white" />
                  </div>
                </div>

                <div className="mb-4 sm:mb-6">
                  <div className="text-xs sm:text-sm mb-1 sm:mb-2 text-gray-500 dark:text-gray-400">
                    {t('当前余额')}
                  </div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide text-gray-900 dark:text-gray-100">
                    {renderQuota(userState?.user?.quota)}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end">
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:space-x-6 lg:space-x-8 mb-3 sm:mb-0">
                    <div className="text-center sm:text-left">
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {t('历史消耗')}
                      </div>
                      <div className="text-xs sm:text-sm font-medium truncate text-gray-600 dark:text-gray-300">
                        {renderQuota(userState?.user?.used_quota)}
                      </div>
                    </div>
                    <div className="text-center sm:text-left">
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {t('请求次数')}
                      </div>
                      <div className="text-xs sm:text-sm font-medium truncate text-gray-600 dark:text-gray-300">
                        {userState.user?.request_count || 0}
                      </div>
                    </div>
                    <div className="text-center sm:text-left">
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {t('用户分组')}
                      </div>
                      <div className="text-xs sm:text-sm font-medium truncate text-gray-600 dark:text-gray-300">
                        {userState?.user?.group || t('默认')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500 dark:from-slate-600 dark:via-slate-500 dark:to-slate-400 opacity-40"></div>
              </div>
            </Card>

            {/* 主内容区域 - 使用Tabs组织不同功能模块 */}
            <div className="p-4">
              <Tabs type='line' defaultActiveKey='models' className="modern-tabs">
                {/* 可用模型Tab */}
                <TabPane
                  tab={
                    <div className="flex items-center">
                      <Settings size={16} className="mr-2" />
                      {t('可用模型')}
                    </div>
                  }
                  itemKey='models'
                >
                  <div className="gap-6 py-4">
                    {/* 可用模型部分 */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center mb-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3">
                          <Settings size={20} className="text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <Typography.Title heading={6} className="mb-0">{t('模型列表')}</Typography.Title>
                          <div className="text-gray-500 text-sm">{t('点击模型名称可复制')}</div>
                        </div>
                      </div>

                      {modelsLoading ? (
                        // 骨架屏加载状态 - 模拟实际加载后的布局
                        <div className="space-y-4">
                          {/* 模拟分类标签 */}
                          <div className="mb-4" style={{ borderBottom: '1px solid var(--semi-color-border)' }}>
                            <div className="flex overflow-x-auto py-2 gap-2">
                              {Array.from({ length: 8 }).map((_, index) => (
                                <Skeleton.Button key={`cat-${index}`} style={{
                                  width: index === 0 ? 130 : 100 + Math.random() * 50,
                                  height: 36,
                                  borderRadius: 8
                                }} />
                              ))}
                            </div>
                          </div>

                          {/* 模拟模型标签列表 */}
                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: 20 }).map((_, index) => (
                              <Skeleton.Button
                                key={`model-${index}`}
                                style={{
                                  width: 100 + Math.random() * 100,
                                  height: 32,
                                  borderRadius: 16,
                                  margin: '4px'
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : models.length === 0 ? (
                        <div className="py-8">
                          <Empty
                            image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
                            darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
                            description={t('没有可用模型')}
                            style={{ padding: '24px 0' }}
                          />
                        </div>
                      ) : (
                        <>
                          {/* 模型分类标签页 */}
                          <div className="mb-4">
                            <Tabs
                              type="card"
                              activeKey={activeModelCategory}
                              onChange={key => setActiveModelCategory(key)}
                              className="mt-2"
                            >
                              {Object.entries(getModelCategories(t)).map(([key, category]) => {
                                // 计算该分类下的模型数量
                                const modelCount = key === 'all'
                                  ? models.length
                                  : models.filter(model => category.filter({ model_name: model })).length;

                                if (modelCount === 0 && key !== 'all') return null;

                                return (
                                  <TabPane
                                    tab={
                                      <span className="flex items-center gap-2">
                                        {category.icon && <span className="w-4 h-4">{category.icon}</span>}
                                        {category.label}
                                        <Tag
                                          color={activeModelCategory === key ? 'red' : 'grey'}
                                          size='small'
                                          shape='circle'
                                        >
                                          {modelCount}
                                        </Tag>
                                      </span>
                                    }
                                    itemKey={key}
                                    key={key}
                                  />
                                );
                              })}
                            </Tabs>
                          </div>

                          <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                            {(() => {
                              // 根据当前选中的分类过滤模型
                              const categories = getModelCategories(t);
                              const filteredModels = activeModelCategory === 'all'
                                ? models
                                : models.filter(model => categories[activeModelCategory].filter({ model_name: model }));

                              // 如果过滤后没有模型，显示空状态
                              if (filteredModels.length === 0) {
                                return (
                                  <Empty
                                    image={<IllustrationNoContent style={{ width: 120, height: 120 }} />}
                                    darkModeImage={<IllustrationNoContentDark style={{ width: 120, height: 120 }} />}
                                    description={t('该分类下没有可用模型')}
                                    style={{ padding: '16px 0' }}
                                  />
                                );
                              }

                              if (filteredModels.length <= MODELS_DISPLAY_COUNT) {
                                return (
                                  <Space wrap>
                                    {filteredModels.map((model) => (
                                      <React.Fragment key={model}>
                                        {renderModelTag(model, {
                                          size: 'large',
                                          shape: 'circle',
                                          onClick: () => copyText(model),
                                        })}
                                      </React.Fragment>
                                    ))}
                                  </Space>
                                );
                              } else {
                                return (
                                  <>
                                    <Collapsible isOpen={isModelsExpanded}>
                                      <Space wrap>
                                        {filteredModels.map((model) => (
                                          <React.Fragment key={model}>
                                            {renderModelTag(model, {
                                              size: 'large',
                                              shape: 'circle',
                                              onClick: () => copyText(model),
                                            })}
                                          </React.Fragment>
                                        ))}
                                        <Tag
                                          color='grey'
                                          type='light'
                                          className="cursor-pointer !rounded-lg"
                                          onClick={() => setIsModelsExpanded(false)}
                                          icon={<IconChevronUp />}
                                        >
                                          {t('收起')}
                                        </Tag>
                                      </Space>
                                    </Collapsible>
                                    {!isModelsExpanded && (
                                      <Space wrap>
                                        {filteredModels
                                          .slice(0, MODELS_DISPLAY_COUNT)
                                          .map((model) => (
                                            <React.Fragment key={model}>
                                              {renderModelTag(model, {
                                                size: 'large',
                                                shape: 'circle',
                                                onClick: () => copyText(model),
                                              })}
                                            </React.Fragment>
                                          ))}
                                        <Tag
                                          color='grey'
                                          type='light'
                                          className="cursor-pointer !rounded-lg"
                                          onClick={() => setIsModelsExpanded(true)}
                                          icon={<IconChevronDown />}
                                        >
                                          {t('更多')} {filteredModels.length - MODELS_DISPLAY_COUNT} {t('个模型')}
                                        </Tag>
                                      </Space>
                                    )}
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </TabPane>

                {/* 账户绑定Tab - 恢复原始版本 */}
                <TabPane
                  tab={
                    <div className="flex items-center">
                      <UserPlus size={16} className="mr-2" />
                      {t('账号设置')}
                    </div>
                  }
                  itemKey='account'
                >
                  <div style={{ marginTop: 20 }}>
                    {/* 账号绑定部分 */}
                    <Typography.Title heading={5}>{t('账号绑定')}</Typography.Title>
                    <div style={{ marginTop: 20 }}>
                      {/* 微信绑定 */}
                      <div style={{ marginBottom: 20 }}>
                        <Typography.Text strong>{t('微信')}</Typography.Text>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                          <Input
                            value={
                              userState.user && userState.user.wechat_id !== ''
                                ? t('已绑定')
                                : t('未绑定')
                            }
                            readOnly={true}
                            style={{ maxWidth: 200 }}
                          />
                          {userState.user && userState.user.wechat_id === '' ? (
                            <Button
                              disabled={!status.wechat_login}
                              onClick={handleWeChatBindClick}
                              type='primary'
                            >
                              {status.wechat_login ? t('绑定微信') : t('未启用')}
                            </Button>
                          ) : (
                            <Button disabled={true} type='secondary'>
                              {t('已绑定')}
                            </Button>
                          )}
                        </div>
                        {userState.user && userState.user.wechat_id === '' && (
                          <div style={{ marginTop: 10 }}>
                            <Typography.Text type='secondary' style={{ fontSize: '12px' }}>
                              {t('扫码绑定微信，如果您之前通过微信登录创建了账号，系统将自动合并数据到当前账号')}
                            </Typography.Text>
                          </div>
                        )}
                        {userState.user && userState.user.wechat_id !== '' && (
                          <div style={{ marginTop: 10 }}>
                            <Typography.Text type='secondary' style={{ fontSize: '12px' }}>
                              {t('微信已绑定，为了账户安全，不支持解绑操作')}
                            </Typography.Text>
                          </div>
                        )}
                        {wechatBindError && (
                          <div style={{ marginTop: 10 }}>
                            <Typography.Text type='danger' style={{ fontSize: '12px' }}>
                              {wechatBindError}
                            </Typography.Text>
                          </div>
                        )}
                      </div>

                      {/* 手机号绑定 */}
                      <div style={{ marginBottom: 20 }}>
                        <Typography.Text strong>{t('手机号')}</Typography.Text>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                          <Input
                            value={
                              userState.user && userState.user.phone !== ''
                                ? userState.user.phone
                                : t('未绑定')
                            }
                            readOnly={true}
                            style={{ maxWidth: 200 }}
                          />
                          {userState.user && userState.user.phone !== '' ? (
                            <Button disabled={true} type='secondary'>
                              {t('已绑定')}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => setShowPhoneBindModal(true)}
                            >
                              {t('绑定手机号')}
                            </Button>
                          )}
                        </div>
                        {userState.user && userState.user.phone !== '' && (
                          <div style={{ marginTop: 10 }}>
                            <Typography.Text type='secondary' style={{ fontSize: '12px' }}>
                              {t('手机号已绑定，为了账户安全，不支持解绑或修改操作')}
                            </Typography.Text>
                          </div>
                        )}
                      </div>

                      {/* 邮箱绑定 */}
                      <div style={{ marginBottom: 20 }}>
                        <Typography.Text strong>{t('邮箱')}</Typography.Text>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                          <Input
                            value={
                              userState.user && userState.user.email !== ''
                                ? userState.user.email
                                : t('未绑定')
                            }
                            readOnly={true}
                            style={{ maxWidth: 200 }}
                          />
                          <Button
                            onClick={() => setShowEmailBindModal(true)}
                          >
                            {userState.user && userState.user.email !== ''
                              ? t('修改绑定')
                              : t('绑定邮箱')}
                          </Button>
                        </div>
                      </div>

                      {/* GitHub绑定 */}
                      <div style={{ marginBottom: 20 }}>
                        <Typography.Text strong>{t('GitHub')}</Typography.Text>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                          <Input
                            value={
                              userState.user && userState.user.github_id !== ''
                                ? userState.user.github_id
                                : t('未绑定')
                            }
                            readOnly={true}
                            style={{ maxWidth: 200 }}
                          />
                          <Button
                            onClick={() => {
                              onGitHubOAuthClicked(status.github_client_id);
                            }}
                            disabled={
                              (userState.user && userState.user.github_id !== '') ||
                              !status.github_oauth
                            }
                          >
                            {status.github_oauth ? t('绑定') : t('未启用')}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 系统设置部分 */}
                    <Typography.Title heading={5} style={{ marginTop: 30 }}>{t('系统设置')}</Typography.Title>
                    <div style={{ marginTop: 20 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Button onClick={generateAccessToken} type="primary">
                          {t('生成系统访问令牌')}
                        </Button>
                        <Button
                          onClick={() => setShowChangePasswordModal(true)}
                        >
                          {t('修改密码')}
                        </Button>
                        <Button
                          type="danger"
                          onClick={() => setShowAccountDeleteModal(true)}
                        >
                          {t('删除账户')}
                        </Button>
                      </Space>

                      {systemToken && (
                        <Input
                          readOnly
                          value={systemToken}
                          onClick={handleSystemTokenClick}
                          style={{ marginTop: '10px' }}
                          placeholder={t('点击复制令牌')}
                        />
                      )}
                    </div>
                  </div>
                </TabPane>

                {/* 通知设置Tab */}
                <TabPane
                  tab={
                    <div className="flex items-center">
                      <Bell size={16} className="mr-2" />
                      {t('其他设置')}
                    </div>
                  }
                  itemKey='notification'
                >
                  <div className="py-4">
                    <Tabs type='card' defaultActiveKey='notify' className="!rounded-lg">
                      <TabPane
                        tab={t('通知设置')}
                        itemKey='notify'
                      >
                        <div className="space-y-6">
                          {/* 通知方式选择 */}
                          <div className="bg-gray-50 rounded-xl">
                            <Typography.Text strong className="block mb-4 pt-4">{t('通知方式')}</Typography.Text>
                            <RadioGroup
                              value={notificationSettings.warningType}
                              onChange={(value) =>
                                handleNotificationSettingChange('warningType', value)
                              }
                              type="pureCard"
                            >
                              <Radio value='email' className="!p-4 !rounded-lg">
                                <div className="flex items-center">
                                  <IconMail className="mr-2 text-slate-600" />
                                  <div>
                                    <div className="font-medium">{t('邮件通知')}</div>
                                    <div className="text-sm text-gray-500">{t('通过邮件接收通知')}</div>
                                  </div>
                                </div>
                              </Radio>
                              <Radio value='webhook' className="!p-4 !rounded-lg">
                                <div className="flex items-center">
                                  <Webhook size={16} className="mr-2 text-slate-600" />
                                  <div>
                                    <div className="font-medium">{t('Webhook通知')}</div>
                                    <div className="text-sm text-gray-500">{t('通过HTTP请求接收通知')}</div>
                                  </div>
                                </div>
                              </Radio>
                            </RadioGroup>
                          </div>

                          {/* Webhook设置 */}
                          {notificationSettings.warningType === 'webhook' && (
                            <div className="space-y-4">
                              <div className="bg-white rounded-xl">
                                <Typography.Text strong className="block mb-3">{t('Webhook地址')}</Typography.Text>
                                <Input
                                  value={notificationSettings.webhookUrl}
                                  onChange={(val) =>
                                    handleNotificationSettingChange('webhookUrl', val)
                                  }
                                  placeholder={t('请输入Webhook地址，例如: https://example.com/webhook')}
                                  size="large"
                                  className="!rounded-lg"
                                  prefix={<Webhook size={16} className="m-2" />}
                                />
                                <div className="text-gray-500 text-sm mt-2">
                                  {t('只支持https，系统将以 POST 方式发送通知，请确保地址可以接收 POST 请求')}
                                </div>
                              </div>

                              <div className="bg-white rounded-xl">
                                <Typography.Text strong className="block mb-3">{t('接口凭证（可选）')}</Typography.Text>
                                <Input
                                  value={notificationSettings.webhookSecret}
                                  onChange={(val) =>
                                    handleNotificationSettingChange('webhookSecret', val)
                                  }
                                  placeholder={t('请输入密钥')}
                                  size="large"
                                  className="!rounded-lg"
                                  prefix={<IconKey />}
                                />
                                <div className="text-gray-500 text-sm mt-2">
                                  {t('密钥将以 Bearer 方式添加到请求头中，用于验证webhook请求的合法性')}
                                </div>
                              </div>

                              <div className="bg-slate-50 rounded-xl">
                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowWebhookDocs(!showWebhookDocs)}>
                                  <div className="flex items-center">
                                    <Globe size={16} className="mr-2 text-slate-600" />
                                    <Typography.Text strong className="text-slate-700">
                                      {t('Webhook请求结构')}
                                    </Typography.Text>
                                  </div>
                                  {showWebhookDocs ? <IconChevronUp /> : <IconChevronDown />}
                                </div>
                                <Collapsible isOpen={showWebhookDocs}>
                                  <pre className="mt-4 bg-gray-800 text-gray-100 rounded-lg text-sm overflow-x-auto">
                                    {`{
  "type": "quota_exceed",      // 通知类型
  "title": "标题",             // 通知标题
  "content": "通知内容",       // 通知内容，支持 {{value}} 变量占位符
  "values": ["值1", "值2"],    // 按顺序替换content中的 {{value}} 占位符
  "timestamp": 1739950503      // 时间戳
}

示例：
{
  "type": "quota_exceed",
  "title": "额度预警通知",
  "content": "您的额度即将用尽，当前剩余额度为 {{value}}",
  "values": ["$0.99"],
  "timestamp": 1739950503
}`}
                                  </pre>
                                </Collapsible>
                              </div>
                            </div>
                          )}

                          {/* 邮件设置 */}
                          {notificationSettings.warningType === 'email' && (
                            <div className="bg-white rounded-xl">
                              <Typography.Text strong className="block mb-3">{t('通知邮箱')}</Typography.Text>
                              <Input
                                value={notificationSettings.notificationEmail}
                                onChange={(val) =>
                                  handleNotificationSettingChange('notificationEmail', val)
                                }
                                placeholder={t('留空则使用账号绑定的邮箱')}
                                size="large"
                                className="!rounded-lg"
                                prefix={<IconMail />}
                              />
                              <div className="text-gray-500 text-sm mt-2">
                                {t('设置用于接收额度预警的邮箱地址，不填则使用账号绑定的邮箱')}
                              </div>
                            </div>
                          )}

                          {/* 预警阈值 */}
                          <div className="bg-white rounded-xl">
                            <Typography.Text strong className="block mb-3">
                              {t('额度预警阈值')} {renderQuotaWithPrompt(notificationSettings.warningThreshold)}
                            </Typography.Text>
                            <AutoComplete
                              value={notificationSettings.warningThreshold}
                              onChange={(val) =>
                                handleNotificationSettingChange('warningThreshold', val)
                              }
                              size="large"
                              className="!rounded-lg w-full max-w-xs"
                              placeholder={t('请输入预警额度')}
                              data={[
                                { value: 100000, label: '0.2$' },
                                { value: 500000, label: '1$' },
                                { value: 1000000, label: '5$' },
                                { value: 5000000, label: '10$' },
                              ]}
                              prefix={<IconBell />}
                            />
                            <div className="text-gray-500 text-sm mt-2">
                              {t('当剩余额度低于此数值时，系统将通过选择的方式发送通知')}
                            </div>
                          </div>
                        </div>
                      </TabPane>

                      <TabPane
                        tab={t('价格设置')}
                        itemKey='price'
                      >
                        <div className="py-4">
                          <div className="space-y-4">
                            {/* 接受未设置价格模型 */}
                            <div className="bg-white rounded-xl">
                              <div className="flex items-start">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mt-1">
                                  <Shield size={20} className="text-slate-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <Typography.Text strong className="block mb-2">
                                        {t('接受未设置价格模型')}
                                      </Typography.Text>
                                      <div className="text-gray-500 text-sm">
                                        {t('当模型没有设置价格时仍接受调用，仅当您信任该网站时使用，可能会产生高额费用')}
                                      </div>
                                    </div>
                                    <Checkbox
                                      checked={notificationSettings.acceptUnsetModelRatioModel}
                                      onChange={(e) =>
                                        handleNotificationSettingChange(
                                          'acceptUnsetModelRatioModel',
                                          e.target.checked,
                                        )
                                      }
                                      className="ml-4"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabPane>

                      <TabPane
                        tab={t('IP记录')}
                        itemKey='ip'
                      >
                        <div className="py-4">
                          <div className="bg-white rounded-xl">
                            <div className="flex items-start">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mt-1">
                                <ShieldCheck size={20} className="text-slate-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Typography.Text strong className="block mb-2">
                                      {t('记录请求与错误日志 IP')}
                                    </Typography.Text>
                                    <div className="text-gray-500 text-sm">
                                      {t('开启后，仅“消费”和“错误”日志将记录您的客户端 IP 地址')}
                                    </div>
                                  </div>
                                  <Checkbox
                                    checked={notificationSettings.recordIpLog}
                                    onChange={(e) =>
                                      handleNotificationSettingChange(
                                        'recordIpLog',
                                        e.target.checked,
                                      )
                                    }
                                    className="ml-4"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabPane>
                    </Tabs>

                    <div className="mt-6 flex justify-end">
                      <Button
                        type='primary'
                        onClick={saveNotificationSettings}
                        size="large"
                        className="!rounded-lg !bg-slate-600 hover:!bg-slate-700"
                        icon={<IconSetting />}
                      >
                        {t('保存设置')}
                      </Button>
                    </div>
                  </div>
                </TabPane>
              </Tabs>
            </div>
          </Card>
        </div>
      </div>

      {/* 微信绑定模态框 - 二维码扫码 */}
      <Modal
        title={t('绑定微信')}
        visible={showWeChatBindModal}
        onCancel={() => {
          setShowWeChatBindModal(false);
          setIsCheckingWechatLogin(false);
        }}
        footer={null}
        width={400}
        centered={true}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {wechatQRCode ? (
            <>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 20,
                padding: 20,
                backgroundColor: '#f8f9fa',
                borderRadius: 8,
                border: '1px solid #e9ecef'
              }}>
                <QRCodeSVG 
                  value={wechatQRCode} 
                  size={200}
                  level="H"
                  includeMargin={true}
                  style={{
                    backgroundColor: 'white',
                    padding: 8,
                    borderRadius: 4
                  }}
                />
              </div>
              <div style={{ marginTop: 20 }}>
                {wechatBindStatus === 'waiting' && (
                  <div>
                    <Typography.Text type='secondary'>
                      {t('请使用微信扫描上方二维码进行绑定')}
                    </Typography.Text>
                    {isCheckingWechatLogin && (
                      <div style={{ marginTop: 10 }}>
                        <Typography.Text type='secondary'>
                          {t('正在检查扫码状态...')}
                        </Typography.Text>
                      </div>
                    )}
                  </div>
                )}
                {wechatBindStatus === 'success' && (
                  <div>
                    <Typography.Text type='success'>
                      {t('绑定成功！')}
                    </Typography.Text>
                  </div>
                )}
                {wechatBindStatus === 'error' && (
                  <div>
                    <Typography.Text type='danger'>
                      {wechatBindError || t('绑定失败')}
                    </Typography.Text>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 0' }}>
              <Typography.Text type='secondary'>
                {t('正在获取二维码...')}
              </Typography.Text>
            </div>
          )}
        </div>
      </Modal>

      {/* 邮箱绑定模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <IconMail className="mr-2 text-blue-500" />
            {t('绑定邮箱地址')}
          </div>
        }
        visible={showEmailBindModal}
        onCancel={() => {
          setShowEmailBindModal(false);
          setShowEmailImageCaptcha(false);
          setEmailImageCaptchaData(null);
        }}
        onOk={bindEmail}
        size={'small'}
        centered={true}
        maskClosable={false}
        className="modern-modal"
      >
        <div className="space-y-4 py-4">
          {!showEmailImageCaptcha ? (
            <>
              <div className="flex gap-3">
                <Input
                  placeholder={t('输入邮箱地址')}
                  onChange={(value) => handleInputChange('email', value)}
                  name='email'
                  type='email'
                  value={inputs.email}
                  size="large"
                  className="!rounded-lg flex-1"
                  prefix={<IconMail />}
                />
                <Button
                  onClick={sendVerificationCode}
                  disabled={disableButton || loading}
                  className="!rounded-lg"
                  type="primary"
                  theme="outline"
                  size='large'
                >
                  {disableButton ? `${t('重新发送')} (${countdown})` : t('获取验证码')}
                </Button>
              </div>

              <Input
                placeholder={t('验证码')}
                name='email_verification_code'
                value={inputs.email_verification_code}
                onChange={(value) =>
                  handleInputChange('email_verification_code', value)
                }
                size="large"
                className="!rounded-lg"
                prefix={<IconKey />}
              />

              {turnstileEnabled && (
                <div className="flex justify-center">
                  <Turnstile
                    sitekey={turnstileSiteKey}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: '14px', color: '#666' }}>
                  {t('请完成图片验证码验证')}
                </span>
              </div>
              <ImageCaptcha
                onVerified={handleEmailImageCaptchaVerified}
                onError={handleEmailImageCaptchaError}
                style={{ display: 'flex', justifyContent: 'center' }}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 手机号绑定模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <IconUser className="mr-2 text-blue-500" />
            {t('绑定手机号')}
          </div>
        }
        visible={showPhoneBindModal}
        onCancel={() => {
          setShowPhoneBindModal(false);
          setShowPhoneImageCaptcha(false);
          setImageCaptchaData(null);
        }}
        onOk={bindPhone}
        size={'small'}
        centered={true}
        maskClosable={false}
        className="modern-modal"
      >
        <div className="space-y-4 py-4">
          {!showPhoneImageCaptcha ? (
            <>
              <div className="flex gap-3">
                <Input
                  placeholder={t('输入手机号')}
                  onChange={(value) => handleInputChange('phone', value)}
                  name='phone'
                  type='tel'
                  value={inputs.phone}
                  size="large"
                  className="!rounded-lg flex-1"
                  prefix={<IconUser />}
                />
                <Button
                  onClick={sendPhoneVerificationCode}
                  disabled={phoneDisableButton || loading}
                  className="!rounded-lg"
                  type="primary"
                  theme="outline"
                  size='large'
                >
                  {phoneDisableButton ? `${t('重新发送')} (${phoneCountdown})` : t('获取验证码')}
                </Button>
              </div>

              <Input
                placeholder={t('验证码')}
                name='phone_verification_code'
                value={inputs.phone_verification_code}
                onChange={(value) =>
                  handleInputChange('phone_verification_code', value)
                }
                size="large"
                className="!rounded-lg"
                prefix={<IconKey />}
              />
            </>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: '14px', color: '#666' }}>
                  {t('请完成图片验证码验证')}
                </span>
              </div>
              <ImageCaptcha
                onVerified={handlePhoneImageCaptchaVerified}
                onError={handlePhoneImageCaptchaError}
                style={{ display: 'flex', justifyContent: 'center' }}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 账户删除模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <IconDelete className="mr-2 text-red-500" />
            {t('删除账户确认')}
          </div>
        }
        visible={showAccountDeleteModal}
        onCancel={() => setShowAccountDeleteModal(false)}
        onOk={deleteAccount}
        size={'small'}
        centered={true}
        className="modern-modal"
      >
        <div className="space-y-4 py-4">
          <Banner
            type='danger'
            description={t('您正在删除自己的帐户，将清空所有数据且不可恢复')}
            closeIcon={null}
            className="!rounded-lg"
          />

          <div>
            <Typography.Text strong className="block mb-2 text-red-600">
              {t('请输入您的用户名以确认删除')}
            </Typography.Text>
            <Input
              placeholder={t('输入你的账户名{{username}}以确认删除', { username: ` ${userState?.user?.username} ` })}
              name='self_account_deletion_confirmation'
              value={inputs.self_account_deletion_confirmation}
              onChange={(value) =>
                handleInputChange('self_account_deletion_confirmation', value)
              }
              size="large"
              className="!rounded-lg"
              prefix={<IconUser />}
            />
          </div>

          {turnstileEnabled && (
            <div className="flex justify-center">
              <Turnstile
                sitekey={turnstileSiteKey}
                onVerify={(token) => {
                  setTurnstileToken(token);
                }}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 修改密码模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <IconLock className="mr-2 text-orange-500" />
            {t('修改密码')}
          </div>
        }
        visible={showChangePasswordModal}
        onCancel={() => setShowChangePasswordModal(false)}
        onOk={changePassword}
        size={'small'}
        centered={true}
        className="modern-modal"
      >
        <div className="space-y-4 py-4">
          <div>
            <Typography.Text strong className="block mb-2">{t('原密码')}</Typography.Text>
            <Input
              name='original_password'
              placeholder={t('请输入原密码')}
              type='password'
              value={inputs.original_password}
              onChange={(value) =>
                handleInputChange('original_password', value)
              }
              size="large"
              className="!rounded-lg"
              prefix={<IconLock />}
            />
          </div>

          <div>
            <Typography.Text strong className="block mb-2">{t('新密码')}</Typography.Text>
            <Input
              name='set_new_password'
              placeholder={t('请输入新密码')}
              type='password'
              value={inputs.set_new_password}
              onChange={(value) =>
                handleInputChange('set_new_password', value)
              }
              size="large"
              className="!rounded-lg"
              prefix={<IconLock />}
            />
          </div>

          <div>
            <Typography.Text strong className="block mb-2">{t('确认新密码')}</Typography.Text>
            <Input
              name='set_new_password_confirmation'
              placeholder={t('请再次输入新密码')}
              type='password'
              value={inputs.set_new_password_confirmation}
              onChange={(value) =>
                handleInputChange('set_new_password_confirmation', value)
              }
              size="large"
              className="!rounded-lg"
              prefix={<IconLock />}
            />
          </div>

          {turnstileEnabled && (
            <div className="flex justify-center">
              <Turnstile
                sitekey={turnstileSiteKey}
                onVerify={(token) => {
                  setTurnstileToken(token);
                }}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PersonalSetting;

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  API,
  copy,
  isRoot,
  showError,
  showInfo,
  showSuccess,
} from '../helpers';
import Turnstile from 'react-turnstile';
import { UserContext } from '../context/User';
import {
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
} from './utils';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Descriptions,
  Image,
  Input,
  InputNumber,
  Layout,
  Modal,
  Space,
  Tag,
  Typography,
  Collapsible,
  Select,
  Radio,
  RadioGroup,
  AutoComplete,
  Checkbox,
  Tabs,
  TabPane,
} from '@douyinfe/semi-ui';
import {
  getQuotaPerUnit,
  renderQuota,
  renderQuotaWithPrompt,
  stringToColor,
} from '../helpers/render';
import TelegramLoginButton from 'react-telegram-login';
import { useTranslation } from 'react-i18next';
import CheckInCalendar from './CheckInCalendar';
import { QRCodeSVG } from 'qrcode.react';
import ImageCaptcha from './ImageCaptcha.js';

const PersonalSetting = () => {
  const [userState, userDispatch] = useContext(UserContext);
  let navigate = useNavigate();
  const { t } = useTranslation();

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
  const [phoneCountdown, setPhoneCountdown] = useState(30);
  const [phoneDisableButton, setPhoneDisableButton] = useState(false);
  const [affLink, setAffLink] = useState('');
  const [systemToken, setSystemToken] = useState('');
  const [models, setModels] = useState([]);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [isModelsExpanded, setIsModelsExpanded] = useState(false);
  const MODELS_DISPLAY_COUNT = 10;

  // 新增状态变量
  const [openCommissionTransfer, setOpenCommissionTransfer] = useState(false);
  const [openCommissionWithdraw, setOpenCommissionWithdraw] = useState(false);
  const [commissionTransferAmount, setCommissionTransferAmount] = useState(0);
  const [commissionWithdrawAmount, setCommissionWithdrawAmount] = useState(0);
  const [withdrawAlipayAccount, setWithdrawAlipayAccount] = useState('');
  const [withdrawContact, setWithdrawContact] = useState('');
  const [pendingWithdrawQuota, setPendingWithdrawQuota] = useState(0);
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [showWithdrawHistory, setShowWithdrawHistory] = useState(false);

  // 新增微信二维码绑定相关状态
  const [wechatQRCode, setWechatQRCode] = useState('');
  const [wechatTicket, setWechatTicket] = useState('');
  const [isCheckingWechatLogin, setIsCheckingWechatLogin] = useState(false);
  const [wechatBindStatus, setWechatBindStatus] = useState('waiting'); // waiting, success, error
  const [wechatBindError, setWechatBindError] = useState('');

  // 新增图片验证码相关状态
  const [showImageCaptcha, setShowImageCaptcha] = useState(false);
  const [imageCaptchaData, setImageCaptchaData] = useState(null);
  const [showPhoneImageCaptcha, setShowPhoneImageCaptcha] = useState(false);

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
    getUserData();
    loadModels();
    getAffLink();
    getWithdrawStatus();
    setTransferAmount(getQuotaPerUnit());
    setCommissionTransferAmount(getQuotaPerUnit());
    setCommissionWithdrawAmount(getQuotaPerUnit() * 10);
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
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  useEffect(() => {
    let phoneCountdownInterval = null;
    if (phoneDisableButton && phoneCountdown > 0) {
      phoneCountdownInterval = setInterval(() => {
        setPhoneCountdown(phoneCountdown - 1);
      }, 1000);
    } else if (phoneCountdown === 0) {
      setPhoneDisableButton(false);
      setPhoneCountdown(30);
    }
    return () => clearInterval(phoneCountdownInterval);
  }, [phoneDisableButton, phoneCountdown]);

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

  const getAffLink = async () => {
    const res = await API.get('/api/user/aff');
    const { success, message, data } = res.data;
    if (success) {
      let link = `${window.location.origin}/register?aff=${data}`;
      setAffLink(link);
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
    let res = await API.get(`/api/user/models`);
    const { success, message, data } = res.data;
    if (success) {
      if (data != null) {
        setModels(data);
      }
    } else {
      showError(message);
    }
  };

  const handleAffLinkClick = async (e) => {
    e.target.select();
    await copy(e.target.value);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  // 新增：专门用于按钮复制的函数
  const handleCopyButton = async () => {
    await copy(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  const handleSystemTokenClick = async (e) => {
    e.target.select();
    await copy(e.target.value);
    showSuccess(t('系统令牌已复制到剪切板'));
  };

  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    const res = await API.post(`/api/user/aff_transfer`, {
      quota: transferAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenTransfer(false);
      getUserData();
    } else {
      showError(message);
    }
  };

  const handleCancel = () => {
    setOpenTransfer(false);
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  const getUsername = () => {
    if (userState.user) {
      return userState.user.username;
    } else {
      return 'null';
    }
  };

  // 新增邀请充值返利划转方法
  const commissionTransfer = async () => {
    if (commissionTransferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    const res = await API.post(`/api/user/commission_transfer`, {
      quota: commissionTransferAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenCommissionTransfer(false);
      getUserData();
      getWithdrawStatus();
    } else {
      showError(message);
    }
  };

  // 新增邀请充值返利提现方法
  const commissionWithdraw = async () => {
    if (commissionWithdrawAmount < getQuotaPerUnit() * 10) { // 最少十块钱
      showError(t('提现金额最低为') + ' ' + renderQuota(getQuotaPerUnit() * 10));
      return;
    }
    if (!withdrawAlipayAccount) {
      showError(t('请输入支付宝账号'));
      return;
    }
    if (!withdrawContact) {
      showError(t('请输入联系方式'));
      return;
    }
    const res = await API.post(`/api/user/commission_withdraw`, {
      quota: commissionWithdrawAmount,
      alipay_account: withdrawAlipayAccount,
      contact: withdrawContact,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenCommissionWithdraw(false);
      setWithdrawAlipayAccount('');
      setWithdrawContact('');
      getUserData();
      getWithdrawStatus();
    } else {
      showError(message);
    }
  };

  // 获取提现状态
  const getWithdrawStatus = async () => {
    try {
      const res = await API.get('/api/user/withdraw_status');
      const { success, data } = res.data;
      if (success) {
        setPendingWithdrawQuota(data.pending_quota || 0);
        setWithdrawHistory(data.withdraws || []);
      }
    } catch (error) {
      console.error('获取提现状态失败:', error);
    }
  };

  // 获取微信扫码二维码
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
          
          // 检查是否超时
          if (checkCount >= maxChecks) {
            isActive = false;
            clearInterval(checkInterval);
            setIsCheckingWechatLogin(false);
            setWechatBindStatus('timeout');
          }
        } else if (status === 'error') {
          // 明确的错误状态才停止轮询
          console.error('微信绑定失败:', message);
          isActive = false;
          clearInterval(checkInterval);
          setIsCheckingWechatLogin(false);
          setWechatBindStatus('error');
          setWechatBindError(message || t('绑定失败'));
        } else if (success === false && message) {
          // 如果有明确的错误消息，也停止轮询
          console.error('微信绑定失败:', message);
          isActive = false;
          clearInterval(checkInterval);
          setIsCheckingWechatLogin(false);
          setWechatBindStatus('error');
          setWechatBindError(message);
        } else {
          // 其他情况继续轮询
          console.log('继续等待，当前状态:', { success, status, message });
        }
      } catch (error) {
        console.error('检查扫码状态失败:', error);
        isActive = false;
        clearInterval(checkInterval);
        setIsCheckingWechatLogin(false);
        setWechatBindStatus('error');
        setWechatBindError(t('网络错误，请检查网络连接'));
      }
    }, 2000); // 每2秒检查一次
    
    // 组件卸载时清理
    return () => {
      isActive = false;
      clearInterval(checkInterval);
    };
  };

  // 绑定微信账号 - 这个方法现在不需要了，因为绑定逻辑已经集成到检查中
  const bindWeChatAccount = async (ticket) => {
    // 这个方法保留备用，但实际绑定逻辑已经在 startCheckWeChatLogin 中处理
    try {
      const res = await API.get(`/api/oauth/wechat/qr/bind?ticket=${ticket}`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('微信账号绑定成功'));
        setWechatBindStatus('success');
        setShowWeChatBindModal(false);
        getUserData(); // 刷新用户数据
      } else {
        showError(message || t('绑定失败'));
        setWechatBindStatus('error');
      }
    } catch (error) {
      showError(t('绑定失败'));
      setWechatBindStatus('error');
    }
  };

  // 处理微信绑定弹窗打开
  const handleWeChatBindClick = () => {
    setShowWeChatBindModal(true);
    setWechatBindStatus('waiting');
    setWechatQRCode('');
    setWechatTicket('');
    setWechatBindError(''); // 清除错误信息
    setIsCheckingWechatLogin(false); // 重置检查状态
    getWeChatQRCode();
  };

  // 删除账户
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

  // 修改密码
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
      setShowChangePasswordModal(false);
    } else {
      showError(message);
    }
  };

  // 发送验证码
  const sendVerificationCode = async () => {
    if (inputs.email === '') {
      showError(t('请输入邮箱！'));
      return;
    }
    setDisableButton(true);
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setLoading(true);
    const res = await API.get(
      `/api/verification?email=${inputs.email}&turnstile=${turnstileToken}`,
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('验证码发送成功，请检查邮箱！'));
    } else {
      showError(message);
    }
    setLoading(false);
  };

  // 绑定邮箱
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
      if (userState.user) {
        userState.user.email = inputs.email;
      }
      getUserData(); // 刷新用户数据
    } else {
      showError(message);
    }
    setLoading(false);
  };

  // 处理图片验证码验证成功
  const handleImageCaptchaVerified = (captchaData) => {
    setImageCaptchaData(captchaData);
    setShowImageCaptcha(false);
    // 验证成功后自动发送手机验证码
    sendPhoneVerificationAfterCaptcha(captchaData);
  };

  // 图片验证码验证失败或错误
  const handleImageCaptchaError = (error) => {
    console.error('图片验证码错误:', error);
    setImageCaptchaData(null);
    // 重新显示验证码对话框
    setShowImageCaptcha(true);
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
    if (turnstileEnabled && turnstileToken === '') {
      showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/sms/send', {
        phone: inputs.phone,
        purpose: 'bind',
        image_captcha_id: captchaData.captcha_id,
        image_captcha_code: captchaData.captcha_code,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('验证码发送成功，请检查手机！'));
        setPhoneCountdown(60); // 开始60秒倒计时
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
      showError(t('发送验证码失败，请重试'));
      // 网络错误时也提示重新验证
      showInfo(t('请重新完成图片验证码验证'));
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
      const res = await API.post('/api/oauth/phone/bind', {
        phone: inputs.phone,
        code: inputs.phone_verification_code,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('手机号绑定成功！'));
        setShowPhoneBindModal(false);
        if (userState.user) {
          userState.user.phone = inputs.phone;
        }
        getUserData(); // 刷新用户数据
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('绑定失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Layout>
        <Layout.Content>
          {/* 用户信息卡片 */}
          <Card
            title={
              <Card.Meta
                avatar={
                  <Avatar
                    size='default'
                    color={stringToColor(getUsername())}
                    style={{ marginRight: 4 }}
                  >
                    {typeof getUsername() === 'string' &&
                      getUsername().slice(0, 1)}
                  </Avatar>
                }
                title={<Typography.Text>{getUsername()}</Typography.Text>}
                description={
                  isRoot() ? (
                    <Tag color='red'>{t('管理员')}</Tag>
                  ) : (
                    <Tag color='blue'>{t('普通用户')}</Tag>
                  )
                }
              ></Card.Meta>
            }
            headerExtraContent={
              <>
                <Space vertical align='start'>
                  <Tag color='green'>{'ID: ' + userState?.user?.id}</Tag>
                  <Tag color='blue'>{userState?.user?.group}</Tag>
                </Space>
              </>
            }
            // footer={
            //   <>
            //     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            //       <Typography.Title heading={6}>
            //         {t('可用模型')}
            //       </Typography.Title>
            //     </div>
            //     <div style={{ marginTop: 10 }}>
            //       {models.length <= MODELS_DISPLAY_COUNT ? (
            //         <Space wrap>
            //           {models.map((model) => (
            //             <Tag
            //               key={model}
            //               color='cyan'
            //               onClick={() => {
            //                 copyText(model);
            //               }}
            //             >
            //               {model}
            //             </Tag>
            //           ))}
            //         </Space>
            //       ) : (
            //         <>
            //           <Collapsible isOpen={isModelsExpanded}>
            //             <Space wrap>
            //               {models.map((model) => (
            //                 <Tag
            //                   key={model}
            //                   color='cyan'
            //                   onClick={() => {
            //                     copyText(model);
            //                   }}
            //                 >
            //                   {model}
            //                 </Tag>
            //               ))}
            //               <Tag
            //                 color='blue'
            //                 type='light'
            //                 style={{ cursor: 'pointer' }}
            //                 onClick={() => setIsModelsExpanded(false)}
            //               >
            //                 {t('收起')}
            //               </Tag>
            //             </Space>
            //           </Collapsible>
            //           {!isModelsExpanded && (
            //             <Space wrap>
            //               {models
            //                 .slice(0, MODELS_DISPLAY_COUNT)
            //                 .map((model) => (
            //                   <Tag
            //                     key={model}
            //                     color='cyan'
            //                     onClick={() => {
            //                       copyText(model);
            //                     }}
            //                   >
            //                     {model}
            //                   </Tag>
            //                 ))}
            //               <Tag
            //                 color='blue'
            //                 type='light'
            //                 style={{ cursor: 'pointer' }}
            //                 onClick={() => setIsModelsExpanded(true)}
            //               >
            //                 {t('更多')} {models.length - MODELS_DISPLAY_COUNT}{' '}
            //                 {t('个模型')}
            //               </Tag>
            //             </Space>
            //           )}
            //         </>
            //       )}
            //     </div>
            //   </>
            // }
          >
            <Descriptions row>
              <Descriptions.Item itemKey={t('当前余额')}>
                {renderQuota(userState?.user?.quota)}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('历史消耗')}>
                {renderQuota(userState?.user?.used_quota)}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('请求次数')}>
                {userState.user?.request_count}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 邀请信息卡片 */}
          <div className="bg-white rounded-xl border-2 border-gray-300 shadow-xl">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">{t('邀请信息')}</h3>
              </div>

              {/* 邀请说明 - 高对比度 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 border-2 border-blue-700 rounded-xl p-5 mb-6 shadow-lg">
                <p className="text-white font-medium leading-relaxed text-center">
                  {t('邀请好友注册，您和好友都可立得 $0.3 额度，可直接使用。好友每次充值，您将获得2%返现，返现金额可转账、可提现，轻松变现无门槛。邀请越多，赚得越多，立即邀请好友开启躺赚模式！')}
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    {t('邀请码')}: <span className="text-blue-800 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md font-medium">{userState?.user?.aff_code || 'Loading...'}</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    {t('邀请链接')}
                  </label>
                  <div className="flex space-x-3">
                    <Input
                        value={affLink}
                        readOnly
                        className="flex-1 bg-slate-100 text-gray-900 border-2 border-slate-300 rounded-lg font-medium"
                        onClick={handleAffLinkClick}
                    />
                    <Button
                        type="secondary"
                        onClick={handleCopyButton}
                        className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 border-2 border-gray-200 hover:border-gray-300 font-bold rounded-xl transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* 签到日历Tab */}
          <Card style={{ marginTop: 10 }}>
            <Tabs type='line' defaultActiveKey='checkin'>
              <TabPane tab={t('签到日历')} itemKey='checkin'>
                <CheckInCalendar />
              </TabPane>
              <TabPane tab={t('提现记录')} itemKey='withdraw'>
                <div style={{ marginTop: 20 }}>
                  {withdrawHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>
                      {t('暂无提现记录')}
                    </div>
                  ) : (
                    <div>
                      {withdrawHistory.map((withdraw) => (
                        <Card 
                          key={withdraw.id} 
                          style={{ marginBottom: 16 }}
                          bodyStyle={{ padding: '16px' }}
                        >
                          <Descriptions row>
                            <Descriptions.Item itemKey={t('提现金额')}>
                              {renderQuota(withdraw.withdraw_quota)}
                            </Descriptions.Item>
                            <Descriptions.Item itemKey={t('状态')}>
                              <Tag 
                                color={
                                  withdraw.withdraw_status === 0 ? 'orange' :
                                  withdraw.withdraw_status === 1 ? 'blue' :
                                  withdraw.withdraw_status === 2 ? 'red' :
                                  withdraw.withdraw_status === 3 ? 'green' : 'default'
                                }
                              >
                                {withdraw.withdraw_status === 0 ? t('待处理') :
                                 withdraw.withdraw_status === 1 ? t('已通过') :
                                 withdraw.withdraw_status === 2 ? t('已拒绝') :
                                 withdraw.withdraw_status === 3 ? t('已支付') : t('未知')}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item itemKey={t('申请时间')}>
                              {new Date(withdraw.create_time).toLocaleString()}
                            </Descriptions.Item>
                            <Descriptions.Item itemKey={t('支付宝账号')}>
                              {withdraw.alipay_account}
                            </Descriptions.Item>
                            <Descriptions.Item itemKey={t('联系方式')}>
                              {withdraw.contact}
                            </Descriptions.Item>
                            {withdraw.admin_comment && (
                              <Descriptions.Item itemKey={t('管理员备注')}>
                                {withdraw.admin_comment}
                              </Descriptions.Item>
                            )}
                          </Descriptions>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabPane>
              <TabPane tab={t('账号设置')} itemKey='settings'>
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

                    {/* Telegram绑定 */}
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
            </Tabs>
          </Card>

          {/* 模态框 */}
          <Modal
            title={t('请输入要划转的数量')}
            visible={openTransfer}
            onOk={transfer}
            onCancel={handleCancel}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('可用额度')}
                {renderQuotaWithPrompt(userState?.user?.aff_quota)}
              </Typography.Text>
              <Input
                style={{ marginTop: 5 }}
                value={userState?.user?.aff_quota}
                disabled={true}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('划转额度')}
                {renderQuotaWithPrompt(transferAmount)}{' '}
                {t('最低') + renderQuota(getQuotaPerUnit())}
              </Typography.Text>
              <div>
                <InputNumber
                  min={0}
                  style={{ marginTop: 5 }}
                  value={transferAmount}
                  onChange={(value) => setTransferAmount(value)}
                  disabled={false}
                />
              </div>
            </div>
          </Modal>

          {/* 邀请充值返利划转模态框 */}
          <Modal
            title={t('请输入要划转的数量')}
            visible={openCommissionTransfer}
            onOk={commissionTransfer}
            onCancel={() => setOpenCommissionTransfer(false)}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('可用额度')}
                {renderQuotaWithPrompt((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0))}
              </Typography.Text>
              <Input
                style={{ marginTop: 5 }}
                value={renderQuota((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0))}
                disabled={true}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('划转额度')}
                {renderQuotaWithPrompt(commissionTransferAmount)}{' '}
                {t('最低') + renderQuota(getQuotaPerUnit())}
              </Typography.Text>
              <div>
                <InputNumber
                  min={0}
                  style={{ marginTop: 5 }}
                  value={commissionTransferAmount}
                  onChange={(value) => setCommissionTransferAmount(value)}
                  disabled={false}
                />
              </div>
            </div>
          </Modal>

          {/* 邀请充值返利提现模态框 */}
          <Modal
            title={t('申请提现')}
            visible={openCommissionWithdraw}
            onOk={commissionWithdraw}
            onCancel={() => setOpenCommissionWithdraw(false)}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('可提现额度')}
                {renderQuotaWithPrompt((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0) - (userState?.user?.withdrawing_quota || 0))}
              </Typography.Text>
              <Input
                style={{ marginTop: 5 }}
                value={renderQuota((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0) - (userState?.user?.withdrawing_quota || 0))}
                disabled={true}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('提现额度')}
                {renderQuotaWithPrompt(commissionWithdrawAmount)}{' '}
                {t('最低') + renderQuota(getQuotaPerUnit() * 10)}
              </Typography.Text>
              <div>
                <InputNumber
                  min={0}
                  style={{ marginTop: 5 }}
                  value={commissionWithdrawAmount}
                  onChange={(value) => setCommissionWithdrawAmount(value)}
                  disabled={false}
                />
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text>{t('支付宝账号')} *</Typography.Text>
              <Input
                style={{ marginTop: 5 }}
                placeholder={t('请输入支付宝账号（邮箱或手机号）')}
                value={withdrawAlipayAccount}
                onChange={(value) => setWithdrawAlipayAccount(value)}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text>{t('联系方式')} *</Typography.Text>
              <Input
                style={{ marginTop: 5 }}
                placeholder={t('请输入您的联系方式（微信/QQ/手机号）')}
                value={withdrawContact}
                onChange={(value) => setWithdrawContact(value)}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text type='secondary' style={{ fontSize: '12px' }}>
                {t('提现将转入您的支付宝账户，处理时间为1-3个工作日，请确保信息准确无误')}
              </Typography.Text>
            </div>
          </Modal>

          {/* 提现记录模态框 */}
          <Modal
            title={t('提现记录')}
            visible={showWithdrawHistory}
            onCancel={() => setShowWithdrawHistory(false)}
            footer={null}
            width={800}
            centered={true}
          >
            <div style={{ marginTop: 20 }}>
              {withdrawHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>
                  {t('暂无提现记录')}
                </div>
              ) : (
                <div>
                  {withdrawHistory.map((withdraw) => (
                    <Card 
                      key={withdraw.id} 
                      style={{ marginBottom: 16 }}
                      bodyStyle={{ padding: '16px' }}
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-600">{t('提现金额')}: </span>
                            <span className="font-bold">{renderQuota(withdraw.withdraw_quota)}</span>
                          </div>
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-600">{t('状态')}: </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              withdraw.withdraw_status === 0 ? 'bg-orange-100 text-orange-800' :
                              withdraw.withdraw_status === 1 ? 'bg-blue-100 text-blue-800' :
                              withdraw.withdraw_status === 2 ? 'bg-red-100 text-red-800' :
                              withdraw.withdraw_status === 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {withdraw.withdraw_status === 0 ? t('待处理') :
                               withdraw.withdraw_status === 1 ? t('已通过') :
                               withdraw.withdraw_status === 2 ? t('已拒绝') :
                               withdraw.withdraw_status === 3 ? t('已支付') : t('未知')}
                            </span>
                          </div>
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-600">{t('申请时间')}: </span>
                            <span className="text-sm">{new Date(withdraw.create_time).toLocaleString()}</span>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-600">{t('支付宝账号')}: </span>
                            <span className="text-sm">{withdraw.alipay_account}</span>
                          </div>
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-600">{t('联系方式')}: </span>
                            <span className="text-sm">{withdraw.contact}</span>
                          </div>
                          {withdraw.admin_comment && (
                            <div className="mb-2">
                              <span className="text-sm font-medium text-gray-600">{t('管理员备注')}: </span>
                              <span className="text-sm">{withdraw.admin_comment}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Modal>

          {/* 微信绑定模态框 */}
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
                      <Typography.Text type='success'>
                        {t('绑定成功！')}
                      </Typography.Text>
                    )}
                    {wechatBindStatus === 'error' && (
                      <Typography.Text type='danger'>
                        {wechatBindError}
                      </Typography.Text>
                    )}
                    {wechatBindStatus === 'timeout' && (
                      <div>
                        <Typography.Text type='warning'>
                          {t('二维码已过期，请重新获取')}
                        </Typography.Text>
                        <Button 
                          type='primary' 
                          style={{ marginTop: 10 }}
                          onClick={getWeChatQRCode}
                        >
                          {t('重新获取二维码')}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <Typography.Text>{t('正在获取二维码...')}</Typography.Text>
                </div>
              )}
            </div>
          </Modal>

          {/* 邮箱绑定模态框 */}
          <Modal
            title={t('绑定邮箱地址')}
            visible={showEmailBindModal}
            onOk={bindEmail}
            onCancel={() => setShowEmailBindModal(false)}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Input
                  placeholder={t('输入邮箱地址')}
                  onChange={(value) => handleInputChange('email', value)}
                  name='email'
                  type='email'
                  style={{ flex: 1, marginRight: 10 }}
                />
                <Button
                  onClick={sendVerificationCode}
                  disabled={disableButton || loading}
                >
                  {disableButton ? `${t('重新发送')} (${countdown})` : t('获取验证码')}
                </Button>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <Input
                placeholder={t('验证码')}
                name='email_verification_code'
                value={inputs.email_verification_code}
                onChange={(value) =>
                  handleInputChange('email_verification_code', value)
                }
              />
            </div>
            {turnstileEnabled && (
              <Turnstile
                sitekey={turnstileSiteKey}
                onVerify={(token) => {
                  setTurnstileToken(token);
                }}
              />
            )}
          </Modal>

          {/* 手机号绑定模态框 */}
          <Modal
            title={t('绑定手机号')}
            visible={showPhoneBindModal}
            onOk={bindPhone}
            onCancel={() => {
              setShowPhoneBindModal(false);
              setShowPhoneImageCaptcha(false);
            }}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            {!showPhoneImageCaptcha ? (
              <>
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Input
                      placeholder={t('输入手机号')}
                      onChange={(value) => handleInputChange('phone', value)}
                      name='phone'
                      type='tel'
                      style={{ flex: 1, marginRight: 10 }}
                    />
                    <Button
                      onClick={sendPhoneVerificationCode}
                      disabled={phoneDisableButton || loading}
                    >
                      {phoneDisableButton ? `${t('重新发送')} (${phoneCountdown})` : t('获取验证码')}
                    </Button>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Input
                    placeholder={t('验证码')}
                    name='phone_verification_code'
                    value={inputs.phone_verification_code}
                    onChange={(value) =>
                      handleInputChange('phone_verification_code', value)
                    }
                  />
                </div>
                {turnstileEnabled && (
                  <Turnstile
                    sitekey={turnstileSiteKey}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                    }}
                  />
                )}
              </>
            ) : (
              <div style={{ marginTop: 20 }}>
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
          </Modal>

          {/* 修改密码模态框 */}
          <Modal
            title={t('修改密码')}
            visible={showChangePasswordModal}
            onOk={changePassword}
            onCancel={() => setShowChangePasswordModal(false)}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            <div style={{ marginTop: 20 }}>
              <Input
                name='original_password'
                placeholder={t('原密码')}
                type='password'
                value={inputs.original_password}
                onChange={(value) =>
                  handleInputChange('original_password', value)
                }
                style={{ marginBottom: 20 }}
              />
              <Input
                name='set_new_password'
                placeholder={t('新密码')}
                type='password'
                value={inputs.set_new_password}
                onChange={(value) =>
                  handleInputChange('set_new_password', value)
                }
                style={{ marginBottom: 20 }}
              />
              <Input
                name='set_new_password_confirmation'
                placeholder={t('确认新密码')}
                type='password'
                value={inputs.set_new_password_confirmation}
                onChange={(value) =>
                  handleInputChange('set_new_password_confirmation', value)
                }
              />
              {turnstileEnabled && (
                <Turnstile
                  sitekey={turnstileSiteKey}
                  onVerify={(token) => {
                    setTurnstileToken(token);
                  }}
                />
              )}
            </div>
          </Modal>



          {/* 删除账户模态框 */}

        </Layout.Content>
      </Layout>
    </div>
  );
};

export default PersonalSetting; 
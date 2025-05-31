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

const PersonalSetting = () => {
  const [userState, userDispatch] = useContext(UserContext);
  let navigate = useNavigate();
  const { t } = useTranslation();

  const [inputs, setInputs] = useState({
    wechat_verification_code: '',
    email_verification_code: '',
    email: '',
    self_account_deletion_confirmation: '',
    original_password: '',
    set_new_password: '',
    set_new_password_confirmation: '',
  });
  const [status, setStatus] = useState({});
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showWeChatBindModal, setShowWeChatBindModal] = useState(false);
  const [showEmailBindModal, setShowEmailBindModal] = useState(false);
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
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
                  {t('邀请好友注册，您和好友都可立得 $0.5 额度，可直接使用。好友每次充值，您将获得2%返现，返现金额可转账、可提现，轻松变现无门槛。邀请越多，赚得越多，立即邀请好友开启躺赚模式！')}
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
              <TabPane tab={t('个人设置')} itemKey='settings'>
                <div style={{ marginTop: 20 }}>
                  <Button onClick={generateAccessToken}>
                    {t('生成系统访问令牌')}
                  </Button>
                  {systemToken && (
                    <Input
                      readOnly
                      value={systemToken}
                      onClick={handleSystemTokenClick}
                      style={{ marginTop: '10px' }}
                    />
                  )}
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
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default PersonalSetting; 
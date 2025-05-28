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
    setTransferAmount(getQuotaPerUnit());
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
            footer={
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Title heading={6}>
                    {t('可用模型')}
                  </Typography.Title>
                </div>
                <div style={{ marginTop: 10 }}>
                  {models.length <= MODELS_DISPLAY_COUNT ? (
                    <Space wrap>
                      {models.map((model) => (
                        <Tag
                          key={model}
                          color='cyan'
                          onClick={() => {
                            copyText(model);
                          }}
                        >
                          {model}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <>
                      <Collapsible isOpen={isModelsExpanded}>
                        <Space wrap>
                          {models.map((model) => (
                            <Tag
                              key={model}
                              color='cyan'
                              onClick={() => {
                                copyText(model);
                              }}
                            >
                              {model}
                            </Tag>
                          ))}
                          <Tag
                            color='blue'
                            type='light'
                            style={{ cursor: 'pointer' }}
                            onClick={() => setIsModelsExpanded(false)}
                          >
                            {t('收起')}
                          </Tag>
                        </Space>
                      </Collapsible>
                      {!isModelsExpanded && (
                        <Space wrap>
                          {models
                            .slice(0, MODELS_DISPLAY_COUNT)
                            .map((model) => (
                              <Tag
                                key={model}
                                color='cyan'
                                onClick={() => {
                                  copyText(model);
                                }}
                              >
                                {model}
                              </Tag>
                            ))}
                          <Tag
                            color='blue'
                            type='light'
                            style={{ cursor: 'pointer' }}
                            onClick={() => setIsModelsExpanded(true)}
                          >
                            {t('更多')} {models.length - MODELS_DISPLAY_COUNT}{' '}
                            {t('个模型')}
                          </Tag>
                        </Space>
                      )}
                    </>
                  )}
                </div>
              </>
            }
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
          <Card style={{ marginTop: 10 }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">{t('邀请返利')}</h3>

              </div>
              <div className="flex items-center bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-2 rounded-full shadow-md">
                <svg className="w-5 h-5 text-white mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-sm font-bold text-white">{t('返利比例')}: 5%</span>
              </div>
            </div>

            {/* 邀请说明 - 高对比度 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 border-2 border-blue-700 rounded-xl p-5 mb-6 shadow-lg">
              <p className="text-white font-medium leading-relaxed text-center">
                {t('邀请好友注册，您可获得 $ 1 额度。好友可获得 $ 1 额度。好友充值前 3 次，您可获得返现。（防止恶意邀请注册，需实名认证）')}
              </p>
            </div>

            <div className="p-6 bg-white rounded-b-xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 邀请奖励卡片 */}
                <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-md">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{t('邀请奖励')}</h3>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('待使用收益')}</span>
                        <span className="text-xl font-bold text-green-700">
                          {renderQuota(userState?.user?.aff_quota || 0)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('总收益')}</span>
                        <span className="text-sm font-bold text-gray-900">
                          {renderQuota(userState?.user?.aff_history_quota || 0)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('邀请人数')}</span>
                        <span className="text-sm font-bold text-gray-900">
                          {userState?.user?.aff_count || 0}
                        </span>
                      </div>
                      
                      <div className="pt-3">
                        <Button
                          type="primary"
                          theme="solid"
                          onClick={() => setOpenTransfer(true)}
                          disabled={!userState?.user?.aff_quota || userState?.user?.aff_quota <= 0}
                          className="w-full py-3 text-white font-bold rounded-xl border-2 transition-all duration-200"
                          style={{ 
                            backgroundColor: '#059669', 
                            borderColor: '#059669',
                            opacity: (!userState?.user?.aff_quota || userState?.user?.aff_quota <= 0) ? 0.6 : 1
                          }}
                        >
                          <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          {t('划转')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 邀请返利卡片 */}
                <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-violet-700 rounded-xl flex items-center justify-center shadow-md">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{t('邀请返利')}</h3>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('待使用收益')}</span>
                        <span className="text-xl font-bold text-purple-700">$0.00</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('总收益')}</span>
                        <span className="text-sm font-bold text-gray-900">$0.00</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('邀请人数')}</span>
                        <span className="text-sm font-bold text-gray-900">0</span>
                      </div>

                      <div className="pt-3 space-y-3">
                        <Button
                          type="primary"
                          theme="solid"
                          disabled={true}
                          className="w-full py-3 text-white font-bold rounded-xl border-2 transition-all duration-200"
                          style={{
                            backgroundColor: '#7c3aed',
                            borderColor: '#7c3aed',
                            opacity: 0.6
                          }}
                        >
                          <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          {t('划转')}
                        </Button>
                        <Button
                          type="tertiary"
                          theme="solid"
                          disabled={true}
                          className="w-full py-3 text-white font-bold rounded-xl border-2 transition-all duration-200"
                          style={{
                            backgroundColor: '#ea580c',
                            borderColor: '#ea580c',
                            opacity: 0.6
                          }}
                        >
                          <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          {t('提现')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 邀请信息 */}
              <div className="mt-6 bg-white rounded-xl border-2 border-gray-200 shadow-lg">
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-5">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{t('邀请信息')}</h3>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-3">
                        {t('邀请码')}: <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-md">{userState?.user?.aff_code || 'Loading...'}</span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-3">
                        {t('邀请链接')}
                      </label>
                      <div className="flex space-x-3">
                        <Input
                          value={affLink}
                          readOnly
                          className="flex-1"
                          style={{ 
                            backgroundColor: '#f1f5f9',
                            border: '2px solid #64748b',
                            borderRadius: '8px',
                            fontWeight: '500'
                          }}
                          onClick={handleAffLinkClick}
                        />
                        <Button
                          type="secondary"
                          onClick={handleAffLinkClick}
                          className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white border-2 border-gray-800 hover:border-gray-900 font-bold rounded-xl transition-all duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 签到日历Tab */}
          <Card style={{ marginTop: 10 }}>
            <Tabs type='line' defaultActiveKey='checkin'>
              <TabPane tab={t('签到日历')} itemKey='checkin'>
                <CheckInCalendar />
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
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default PersonalSetting; 
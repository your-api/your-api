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
            <Typography.Title heading={6}>{t('邀请信息')}</Typography.Title>
            <div style={{ marginTop: 20 }}>
              <Typography.Text strong>{t('邀请链接')}</Typography.Text>
              <div style={{ display: 'flex', marginTop: 10 }}>
                <Input
                  value={affLink}
                  onClick={handleAffLinkClick}
                  readOnly
                  style={{ flex: 1, marginRight: 10 }}
                />
                <Button onClick={handleAffLinkClick}>
                  {t('复制')}
                </Button>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <Descriptions row>
                <Descriptions.Item itemKey={t('邀请收益')}>
                  {renderQuota(userState?.user?.aff_quota || 0)}
                </Descriptions.Item>
                <Descriptions.Item itemKey={t('邀请人数')}>
                  {userState?.user?.aff_count || 0}
                </Descriptions.Item>
              </Descriptions>
              <Button
                type="primary"
                onClick={() => setOpenTransfer(true)}
                disabled={!userState?.user?.aff_quota || userState?.user?.aff_quota <= 0}
                style={{ marginTop: 10 }}
              >
                {t('划转邀请收益')}
              </Button>
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
import React, { useEffect, useState, useRef, useContext } from 'react';
import { API, isMobile, showError, showInfo, showSuccess, copy } from '../../helpers';
import {
  renderNumber,
  renderQuota,
  renderQuotaWithAmount,
  getQuotaPerUnit,
  renderQuotaWithPrompt,
} from '../../helpers/render';
import {
  Layout,
  Typography,
  Card,
  Button,
  Form,
  Divider,
  Space,
  Modal,
  Toast,
  RadioGroup,
  Radio,
  Spin,
  Input,
  InputNumber,
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { UserContext } from '../../context/User';

const TopUp = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [redemptionCode, setRedemptionCode] = useState('');
  const [topUpCode, setTopUpCode] = useState('');
  const [topUpCount, setTopUpCount] = useState(0);
  const [minTopupCount, setMinTopUpCount] = useState(1);
  const [amount, setAmount] = useState(0.0);
  const [minTopUp, setMinTopUp] = useState(1);
  const [topUpLink, setTopUpLink] = useState('');
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(true);
  const [userQuota, setUserQuota] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [payWay, setPayWay] = useState('zfb');
  const [customAmount, setCustomAmount] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [paymentMethod, setPaymentMethod] = useState('platform');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [outTradeNo, setOutTradeNo] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [affLink, setAffLink] = useState('');
  const [affCode, setAffCode] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openWithdraw, setOpenWithdraw] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [transferType, setTransferType] = useState('reward');
  const timerRef = useRef(null);
  const statusCheckRef = useRef(null);

  const predefinedAmounts = [2, 100, 150, 200, 300, 500, 1000];

  const topUp = async () => {
    if (redemptionCode === '') {
      showInfo(t('请输入兑换码！'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('兑换成功！'));
        Modal.success({
          title: t('兑换成功！'),
          content: t('成功兑换额度：') + renderQuota(data),
          centered: true,
        });
        setUserQuota((quota) => {
          return quota + data;
        });
        setRedemptionCode('');
      } else {
        showError(message);
      }
    } catch (err) {
      showError(t('请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTopUpLink = () => {
    if (!topUpLink) {
      showError(t('超级管理员未设置充值链接！'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const preTopUp = async (payment) => {
    if (!enableOnlineTopUp) {
      showError(t('管理员未开启在线充值！'));
      return;
    }
    
    const finalAmount = customAmount ? topUpCount : selectedAmount;
    
    await getAmount(finalAmount);
    if (finalAmount < minTopUp) {
      showError(t('充值数量不能小于') + minTopUp);
      return;
    }
    setPayWay(payment);
    setOpen(true);
  };

  const onlineTopUp = async () => {
    if (amount <= minTopUp) {
      showError('充值数量不能小于' + minTopUp);
      return;
    }

    if (amount === 0) {
      await getAmount();
    }
    
    const finalAmount = customAmount ? topUpCount : selectedAmount;
    
    if (finalAmount < minTopUp) {
      showError('充值数量不能小于' + minTopUp);
      return;
    }
    setOpen(false);
    setPaymentLoading(true);
    
    try {
      let pay_way = 0
      if (payWay === 'zfb') {
        pay_way = 0
      }else if (payWay === 'wx') {
        pay_way = 1
      }
      
      const res = await API.post('/api/order/getTradeInfo', {
        amount: parseInt(amount),
        payWay: pay_way
      });
      
      if (res !== undefined) {
        const { success, message, data } = res.data;
        
        if (success) {
          const { outTradeNo, qrCode } = data;
          
          setOutTradeNo(outTradeNo);
          setQrCodeUrl(qrCode);
          
          setShowPaymentModal(true);
          setPaymentStatus('pending');
          
          setCountdown(300);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(timerRef.current);
                if (statusCheckRef.current) {
                  clearInterval(statusCheckRef.current);
                  statusCheckRef.current = null;
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          startPaymentStatusCheck(outTradeNo);
          
        } else {
          showError(message || '获取支付信息失败');
        }
      } else {
        showError('请求失败');
      }
    } catch (err) {
      console.log(err);
      showError('支付请求失败，请稍后重试');
    } finally {
      setPaymentLoading(false);
    }
  };

  const startPaymentStatusCheck = (orderNo) => {
    if (statusCheckRef.current) {
      clearInterval(statusCheckRef.current);
    }
    
    statusCheckRef.current = setInterval(async () => {
      try {
        const res = await API
            .get(`/api/order/queryTradeStatus?outTradeNo=${orderNo}&payWay=${payWay === 'zfb' ? 0 : 1}`);
        
        if (res && res.data) {
          const { success, data, message } = res.data;
          
          if (success && data) {
            if (data == 'OK') {
              clearInterval(statusCheckRef.current);
              statusCheckRef.current = null;

              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }

              setPaymentStatus('success');

              await getUserQuota();

              setTimeout(() => {
                setShowPaymentModal(false);

                Modal.success({
                  title: t('充值成功'),
                  content: t('您的账户已成功充值，感谢您的使用！'),
                  centered: true,
                });
              }, 1000);
            }
          }
        }
      } catch (error) {
        console.error('查询支付状态失败:', error);
      }
    }, 3000);
  };

  const getUserQuota = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      setUserQuota(data.quota);
      userDispatch({ type: 'login', payload: data });
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
      setAffCode(data);
    } else {
      showError(message);
    }
  };

  const handleAffLinkClick = async (e) => {
    e.target.select();
    await copy(e.target.value);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  // 新增划转和提现相关函数
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
      getUserQuota().then();
    } else {
      showError(message);
    }
  };

  const withdraw = async () => {
    if (withdrawAmount < getQuotaPerUnit()) {
      showError(t('提现金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    const res = await API.post(`/api/user/aff_withdraw`, {
      quota: withdrawAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenWithdraw(false);
      getUserQuota().then();
    } else {
      showError(message);
    }
  };

  const handleWithdrawCancel = () => {
    setOpenWithdraw(false);
  };

  const openTransferModal = (type) => {
    setTransferType(type);
    setTransferAmount(getQuotaPerUnit());
    setOpenTransfer(true);
  };

  const openWithdrawModal = () => {
    setWithdrawAmount(getQuotaPerUnit());
    setOpenWithdraw(true);
  };

  const handleTransferCancel = () => {
    setOpenTransfer(false);
  };

  useEffect(() => {
    let status = localStorage.getItem('status');
    if (status) {
      status = JSON.parse(status);
      if (status.top_up_link) {
        setTopUpLink(status.top_up_link);
      }
      if (status.min_topup) {
        setMinTopUp(status.min_topup);
      }
      // if (status.enable_online_topup) {
      //   setEnableOnlineTopUp(status.enable_online_topup);
      // }
    }
    getUserQuota().then();
    getAffLink().then();
  }, []);

  const renderAmount = () => {
    return amount + ' ' + t('元');
  };

  const getAmount = async (value) => {
    if (value === undefined) {
      value = customAmount ? topUpCount : selectedAmount;
    }
    try {
      const res = await API.post('/api/user/amount', {
        amount: parseFloat(value),
        top_up_code: topUpCode,
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleAmountChange = (amount) => {
    if (amount === 'custom') {
      setCustomAmount(true);
      setTopUpCount(1);
      getAmount(1);
    } else {
      setCustomAmount(false);
      setSelectedAmount(amount);
      getAmount(amount);
    }
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClosePaymentModal = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (statusCheckRef.current) {
      clearInterval(statusCheckRef.current);
      statusCheckRef.current = null;
    }
    
    setShowPaymentModal(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (statusCheckRef.current) {
        clearInterval(statusCheckRef.current);
      }
    };
  }, []);

  return (
    <div>
      <Layout>
        <Layout.Header>
          <h3>{t('我的钱包')}</h3>
        </Layout.Header>
        <Layout.Content>
          <Modal
            title={t('确定要充值吗')}
            visible={open}
            onOk={onlineTopUp}
            onCancel={handleCancel}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            <p>
              {t('充值数量')}：{customAmount ? topUpCount : selectedAmount}
            </p>
            <p>
              {t('实付金额')}：{renderAmount()}
            </p>
            <p>{t('是否确认充值？')}</p>
          </Modal>

          <Modal
            title={
              <div className="flex items-center text-[#1677FF] font-medium">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M992 384H32c-17.664 0-32 14.336-32 32v384c0 17.664 14.336 32 32 32h960c17.664 0 32-14.336 32-32V416c0-17.664-14.336-32-32-32z m-24 392c0 4.416-3.584 8-8 8H64c-4.416 0-8-3.584-8-8V448c0-4.416 3.584-8 8-8h896c4.416 0 8 3.584 8 8v328z" fill="#1677FF"></path>
                  <path d="M96 512h832c8.832 0 16-7.168 16-16s-7.168-16-16-16H96c-8.832 0-16 7.168-16 16s7.168 16 16 16zM512 224c8.832 0 16-7.168 16-16V80c0-8.832-7.168-16-16-16s-16 7.168-16 16v128c0 8.832 7.168 16 16 16zM512 944c-8.832 0-16 7.168-16 16v64c0 8.832 7.168 16 16 16s16-7.168 16-16v-64c0-8.832-7.168-16-16-16z" fill="#1677FF"></path>
                </svg>
                {t('支付宝付款')}
              </div>
            }
            visible={showPaymentModal}
            onCancel={handleClosePaymentModal}
            footer={null}
            maskClosable={false}
            size={'small'}
            centered={true}
            className="alipay-payment-modal"
          >
            <div className="flex flex-col items-center p-4">
              {paymentLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Spin size="large" style={{ color: "#1677FF" }} />
                </div>
              ) : paymentStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="text-[#1677FF] text-6xl mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-xl font-medium text-gray-800">{t('支付成功')}</p>
                  <p className="text-sm text-gray-500 mt-2">{t('正在处理您的充值...')}</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-5 bg-[#f0f9ff] w-full py-3 rounded-lg border border-[#e6f4ff]">
                    <p className="text-xl font-semibold mb-1 text-[#1677FF]">¥{amount}</p>
                    <p className="text-xs text-gray-500">{t('订单号')}: {outTradeNo}</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg border border-[#e6f4ff] mb-4 flex flex-col items-center">
                    <div className="mb-2 text-sm text-[#1677FF] font-medium">
                      {t('请用支付宝扫码支付')}
                    </div>
                    
                    {qrCodeUrl ? (
                      <div className="p-3 border border-[#1677FF] rounded-lg">
                        <QRCodeSVG
                          value={qrCodeUrl}
                          size={180}
                          level="H"
                          includeMargin={true}
                          className="mx-auto"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                        <p className="text-gray-400">{t('二维码加载失败')}</p>
                      </div>
                    )}
                    
                    <div className="mt-3 flex items-center text-[#1677FF]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">{formatCountdown(countdown)}</span>
                    </div>
                  </div>
                  
                  <div className="text-center text-xs text-gray-500 max-w-xs px-3">
                    <div className="flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 mr-1 text-[#1677FF]" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <path d="M512 85.333333c-235.52 0-426.666667 191.146667-426.666667 426.666667s191.146667 426.666667 426.666667 426.666667 426.666667-191.146667 426.666667-426.666667-191.146667-426.666667-426.666667-426.666667z m-26.88 640a45.226667 45.226667 0 0 1-45.226667-45.226666 45.226667 45.226667 0 0 1 45.226667-45.226667 45.226667 45.226667 0 0 1 45.226667 45.226667c0 24.746667-20.48 45.226667-45.226667 45.226666z m72.533333-213.333333c-17.066667 6.826667-29.013333 13.653333-36.693333 24.746667-3.413333 6.826667-5.973333 17.92-5.973333 34.986666h-56.32v-14.506666c0-17.066667 3.413333-31.573333 10.24-43.52 6.826667-11.946667 19.626667-24.746667 39.253333-35.84 17.066667-9.386667 29.013333-17.066667 36.693333-26.453334 6.826667-9.386667 10.24-19.626667 10.24-31.573333 0-13.653333-5.12-24.746667-15.36-33.28-10.24-8.533333-23.893333-13.653333-40.96-13.653333-38.4 0-64.853333 25.6-64.853333 66.56h-56.32c1.706667-30.72 11.946667-56.32 29.866666-75.093334 20.48-21.333333 49.493333-31.573333 87.04-31.573333 32.426667 0 58.88 7.68 80.213334 23.04 21.333333 15.36 31.573333 36.693333 31.573333 64.853333 0 13.653333-4.266667 27.306667-11.093333 39.253334-6.826667 11.946667-16.213333 21.333333-37.546667 31.573333z" fill="#1677FF"></path>
                      </svg>
                      <span>{t('请不要关闭此窗口')}</span>
                    </div>
                    <p>{t('扫码后请在支付宝中确认付款')}</p>
                    <p>{t('付款完成后将自动为您处理订单')}</p>
                  </div>
                  
                  {countdown === 0 && (
                    <div className="mt-4 w-full">
                      <Button
                        type="primary"
                        theme="solid"
                        onClick={() => { setShowPaymentModal(false); setOpen(true); }}
                        className="w-full py-2 bg-[#1677FF] hover:bg-[#4096ff] border-none"
                        style={{ backgroundColor: "#1677FF" }}
                      >
                        {t('二维码已过期，点击重新获取')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Modal>

          {/* 划转模态框 */}
          <Modal
            title={t('请输入要划转的数量')}
            visible={openTransfer}
            onOk={transfer}
            onCancel={handleTransferCancel}
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
                value={renderQuota(userState?.user?.aff_quota || 0)}
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
          
          {/* 提现模态框 */}
          <Modal
            title={t('请输入要提现的数量')}
            visible={openWithdraw}
            onOk={withdraw}
            onCancel={handleWithdrawCancel}
            maskClosable={false}
            size={'small'}
            centered={true}
          >
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('可提现额度')} $0.00
              </Typography.Text>
              <Input
                style={{ marginTop: 5 }}
                value="$0.00"
                disabled={true}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text>
                {t('提现额度')}
                {renderQuotaWithPrompt(withdrawAmount)}{' '}
                {t('最低') + renderQuota(getQuotaPerUnit())}
              </Typography.Text>
              <div>
                <InputNumber
                  min={0}
                  style={{ marginTop: 5 }}
                  value={withdrawAmount}
                  onChange={(value) => setWithdrawAmount(value)}
                  disabled={false}
                />
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <Typography.Text type='secondary' style={{ fontSize: '12px' }}>
                {t('提现将转入您绑定的支付宝账户，处理时间为1-3个工作日')}
              </Typography.Text>
            </div>
          </Modal>

          <div className="mt-6 flex justify-center">
            <Card className="w-full max-w-3xl shadow-lg rounded-xl overflow-hidden">
              <div className="bg-white p-6 border-b">
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-medium mb-2 text-gray-600">{t('当前余额')}</h3>
                  <div className="text-3xl font-bold text-gray-800">{renderQuota(userQuota)}</div>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-lg font-medium mb-4">{t('在线充值')}</h4>

                <div className="mb-6">
                  <div className="text-sm font-medium text-gray-600 mb-2 text-center">{t('购买面额')}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {predefinedAmounts.map((amountValue) => (
                        <div
                            key={amountValue}
                            onClick={() => handleAmountChange(amountValue)}
                            className={`cursor-pointer p-3 border rounded-lg text-center transition-all ${
                                !customAmount && selectedAmount === amountValue
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 hover:border-blue-300'
                            }`}
                        >
                          <div className="font-bold text-lg flex items-center justify-center h-full">{amountValue} 元</div>
                        </div>
                    ))}
                    <div
                        onClick={() => handleAmountChange('custom')}
                        className={`cursor-pointer p-3 border rounded-lg text-center transition-all ${
                            customAmount
                                ? 'border-blue-500 bg-blue-50 text-blue-600'
                                : 'border-gray-200 hover:border-blue-300'
                        }`}
                    >
                      <div className="font-bold mb-1 text-lg">{t('自定义金额')}</div>
                      <div className="flex items-center justify-center h-8">
                        <span className="text-base mr-1 flex items-center">￥</span>
                        {customAmount ? (
                            <input
                                type="number"
                                min="1"
                                value={topUpCount}
                                onChange={(e) => {
                                  const value = Math.max(1, parseFloat(e.target.value) || 0);
                                  setTopUpCount(value);
                                  getAmount(value);
                                }}
                                className="w-24 text-center border rounded p-1 text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="text-base flex items-center">1.00</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <Button
                        type="primary"
                        theme="solid"
                        onClick={() => preTopUp('zfb')}
                        disabled={!enableOnlineTopUp}
                        className="
                        flex-1 md:flex-none min-w-[120px]
                        py-3 px-5 rounded-lg
                        flex items-center justify-center font-medium
                        transition-transform transform
                        shadow-md
                        disabled:opacity-50 disabled:cursor-not-allowed
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300
                        bg-gradient-to-r from-blue-500 to-blue-600
                        hover:scale-105
                      "
                    >
                      <div className="flex items-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-5 h-5 mr-2"
                        >
                          <path d="M22.5 12.25c0-5.66-4.59-10.25-10.25-10.25S2 6.59 2 12.25c0 4.84 3.33 8.9 7.83 10.04v-7.12H7.25v-2.92h2.58v-2.23c0-2.54 1.51-3.95 3.82-3.95 1.11 0 2.27.2 2.27.2v2.49h-1.28c-1.26 0-1.65.78-1.65 1.58v1.9h2.8l-.45 2.92h-2.35v7.12c4.5-1.14 7.83-5.2 7.83-10.04z" />
                        </svg>
                        <span>{t('支付宝')}</span>
                      </div>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 text-sm text-gray-500">
                  <p>{t('说明：充值后额度将立即到账，如有问题请联系客服')}</p>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-b">
                <h4 className="text-lg font-medium mb-4">{t('兑换码充值')}</h4>
                <Form className="space-y-4">
                  <Form.Input
                    field={'redemptionCode'}
                    label={t('兑换码')}
                    placeholder={t('请输入兑换码')}
                    name='redemptionCode'
                    value={redemptionCode}
                    onChange={(value) => {
                      setRedemptionCode(value);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {topUpLink && (
                      <Button
                        type={'primary'}
                        theme={'solid'}
                        onClick={openTopUpLink}
                        className="hover:opacity-90"
                      >
                        {t('获取兑换码')}
                      </Button>
                    )}
                    <Button
                      type={'warning'}
                      theme={'solid'}
                      onClick={topUp}
                      disabled={isSubmitting}
                      className="hover:opacity-90"
                    >
                      {isSubmitting ? t('兑换中...') : t('立即兑换')}
                    </Button>
                  </div>
                </Form>
              </div>

            </Card>
          </div>

          {/* 邀请返利模块 - 高对比度版本 */}
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-3xl">
              {/* 标题和返利比例 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('邀请返利')}</h2>
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

              {/* 两列布局 - 高对比度 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 邀请奖励卡片 - 高对比度 */}
                <div className="bg-white rounded-xl border-2 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-md">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
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
                          onClick={() => openTransferModal('reward')}
                          disabled={!userState?.user?.aff_quota || userState?.user?.aff_quota <= 0}
                          className="w-full py-3 text-white font-bold rounded-xl border-2 transition-all duration-200"
                          style={{ 
                            backgroundColor: '#059669', 
                            borderColor: '#059669',
                            opacity: (!userState?.user?.aff_quota || userState?.user?.aff_quota <= 0) ? 0.6 : 1
                          }}
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          {t('划转')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 邀请返利卡片 - 高对比度 */}
                <div className="bg-white rounded-xl border-2 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-violet-700 rounded-xl flex items-center justify-center shadow-md">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
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
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
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
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          {t('提现')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 邀请信息 - 高对比度 */}
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
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-3">
                        {t('邀请码')}: <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-md">{affCode || 'Loading...'}</span>
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default TopUp;

import React, { useEffect, useState, useRef } from 'react';
import { API, isMobile, showError, showInfo, showSuccess } from '../../helpers';
import {
  renderNumber,
  renderQuota,
  renderQuotaWithAmount,
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
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

const TopUp = () => {
  const { t } = useTranslation();
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
    } else {
      showError(message);
    }
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
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default TopUp;

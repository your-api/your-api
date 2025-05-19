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

  const predefinedAmounts = [50, 100, 150, 200, 300, 500, 1000];

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
        const res = await API.post('/api/order/queryTradeStatus', {
          outTradeNo: orderNo
        });
        
        if (res && res.data) {
          const { success, data, message } = res.data;
          
          if (success && data) {
            if (data.paid) {
              clearInterval(statusCheckRef.current);
              statusCheckRef.current = null;
              
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              
              setPaymentStatus('success');
              
              if (data.quota) {
                setUserQuota(data.quota);
              } else {
                await getUserQuota();
              }
              
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
            title={t('请扫码支付')}
            visible={showPaymentModal}
            onCancel={handleClosePaymentModal}
            footer={null}
            maskClosable={false}
            size={'small'}
            centered={true}
            className="payment-modal"
          >
            <div className="flex flex-col items-center p-4">
              {paymentLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Spin size="large" />
                </div>
              ) : paymentStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="text-green-500 text-6xl mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-xl font-medium text-gray-800">{t('支付成功')}</p>
                  <p className="text-sm text-gray-500 mt-2">{t('正在处理您的充值...')}</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <p className="text-lg font-semibold mb-2">{t('支付金额')}: ¥{amount}</p>
                    <p className="text-sm text-gray-500 mb-1">{t('订单号')}: {outTradeNo}</p>
                    <div className="text-orange-500 font-medium">
                      {t('支付倒计时')}: {formatCountdown(countdown)}
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
                    {qrCodeUrl ? (
                      <QRCodeSVG
                        value={qrCodeUrl}
                        size={200}
                        level="H"
                        includeMargin={true}
                        className="mx-auto"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                        <p className="text-gray-400">{t('二维码加载失败')}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center text-sm text-gray-600 max-w-xs">
                    <p>{t('请使用支付宝扫描二维码完成支付')}</p>
                    <p>{t('支付完成后系统将自动处理您的订单')}</p>
                  </div>
                  
                  {countdown === 0 && (
                    <div className="mt-4 w-full">
                      <Button
                        type="primary"
                        theme="solid"
                        onClick={() => { setShowPaymentModal(false); setOpen(true); }}
                        className="w-full py-2"
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
                          <div className="font-bold text-lg flex items-center justify-center h-full">{amountValue}.00元</div>
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

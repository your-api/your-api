import React, { useEffect, useState } from 'react';
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
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const TopUp = () => {
  const { t } = useTranslation();
  const [redemptionCode, setRedemptionCode] = useState('');
  const [topUpCode, setTopUpCode] = useState('');
  const [topUpCount, setTopUpCount] = useState(0);
  const [minTopupCount, setMinTopUpCount] = useState(1);
  const [amount, setAmount] = useState(0.0);
  const [minTopUp, setMinTopUp] = useState(1);
  const [topUpLink, setTopUpLink] = useState('');
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
  const [userQuota, setUserQuota] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [payWay, setPayWay] = useState('zfb');
  const [customAmount, setCustomAmount] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [paymentMethod, setPaymentMethod] = useState('platform');

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
    if (amount === 0) {
      await getAmount();
    }
    
    const finalAmount = customAmount ? topUpCount : selectedAmount;
    
    if (finalAmount < minTopUp) {
      showError('充值数量不能小于' + minTopUp);
      return;
    }
    setOpen(false);
    try {
      const res = await API.post('/api/user/pay', {
        amount: parseInt(finalAmount),
        top_up_code: topUpCode,
        payment_method: payWay,
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          let params = data;
          let url = res.data.url;
          let form = document.createElement('form');
          form.action = url;
          form.method = 'POST';
          // 判断是否为safari浏览器
          let isSafari =
            navigator.userAgent.indexOf('Safari') > -1 &&
            navigator.userAgent.indexOf('Chrome') < 1;
          if (!isSafari) {
            form.target = '_blank';
          }
          for (let key in params) {
            let input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key];
            form.appendChild(input);
          }
          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
        } else {
          showError(data);
        }
      } else {
        showError(res);
      }
    } catch (err) {
      console.log(err);
    }
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
      if (status.enable_online_topup) {
        setEnableOnlineTopUp(status.enable_online_topup);
      }
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

          <div className="mt-6 flex justify-center">
            <Card className="w-full max-w-3xl shadow-lg rounded-xl overflow-hidden">
              {/* 余额显示 */}
              <div className="bg-white p-6 border-b">
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-medium mb-2 text-gray-600">{t('当前余额')}</h3>
                  <div className="text-3xl font-bold text-gray-800">{renderQuota(userQuota)}</div>
                </div>
              </div>

              {/* 兑换码部分 */}
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

              {/* 在线充值部分 */}
              <div className="p-6">
                <h4 className="text-lg font-medium mb-4">{t('在线充值')}</h4>

                {/* 购买面额选择 */}
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
                

                {/* 支付按钮选择 */}
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <Button
                      type="primary"
                      theme="solid"
                      onClick={() => preTopUp('zfb')}
                      disabled={!enableOnlineTopUp}
                      className="flex-1 md:flex-none min-w-[120px] py-3 flex items-center justify-center"
                      style={{
                        backgroundColor: '#1677FF',
                      }}
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
                          <path d="M22.5 12.25c0-5.66-4.59-10.25-10.25-10.25S2 6.59 2 12.25c0 4.84 3.33 8.9 7.83 10.04v-7.12H7.25v-2.92h2.58v-2.23c0-2.54 1.51-3.95 3.82-3.95 1.11 0 2.27.2 2.27.2v2.49h-1.28c-1.26 0-1.65.78-1.65 1.58v1.9h2.8l-.45 2.92h-2.35v7.12c4.5-1.14 7.83-5.2 7.83-10.04z"></path>
                        </svg>
                        <span>{t('支付宝')}</span>
                      </div>
                    </Button>
                    <Button
                      type="primary"
                      theme="solid"
                      onClick={() => preTopUp('wx')}
                      disabled={!enableOnlineTopUp}
                      className="flex-1 md:flex-none min-w-[120px] py-3 flex items-center justify-center"
                      style={{
                        backgroundColor: '#07C160',
                      }}
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
                          <path d="M22.5 12.25c0-5.66-4.59-10.25-10.25-10.25S2 6.59 2 12.25c0 4.84 3.33 8.9 7.83 10.04v-7.12H7.25v-2.92h2.58v-2.23c0-2.54 1.51-3.95 3.82-3.95 1.11 0 2.27.2 2.27.2v2.49h-1.28c-1.26 0-1.65.78-1.65 1.58v1.9h2.8l-.45 2.92h-2.35v7.12c4.5-1.14 7.83-5.2 7.83-10.04z"></path>
                        </svg>
                        <span>{t('微信')}</span>
                      </div>
                    </Button>
                  </div>
                  <Button
                    type="primary"
                    theme="solid"
                    onClick={() => preTopUp(payWay)}
                    disabled={!enableOnlineTopUp}
                    className="w-full py-3"
                  >
                    {t('立即充值')}
                  </Button>
                </div>

                {/* 支付说明 */}
                <div className="mt-6 text-sm text-gray-500">
                  <p>{t('说明：充值后额度将立即到账，如有问题请联系客服')}</p>
                </div>
              </div>
            </Card>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default TopUp;

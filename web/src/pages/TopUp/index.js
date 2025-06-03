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
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [showWithdrawHistory, setShowWithdrawHistory] = useState(false);
  const [withdrawAlipayAccount, setWithdrawAlipayAccount] = useState('');
  const [withdrawContact, setWithdrawContact] = useState('');
  // 新增：存储从后台获取的折扣层级
  const [discountTiers, setDiscountTiers] = useState([]);
  const [discountTiersLoaded, setDiscountTiersLoaded] = useState(false);
  const timerRef = useRef(null);
  const statusCheckRef = useRef(null);

  // 默认预设金额（将根据折扣层级动态调整）
  const [predefinedAmounts, setPredefinedAmounts] = useState([10, 99, 199, 499, 999]);

  // 状态变量存储后端返回的金额信息
  const [amountInfo, setAmountInfo] = useState({
    payAmount: 0,      // 需要支付的金额
    creditAmount: 0,   // 实际到账金额
    discount: 0        // 折扣比例
  });

  // 获取折扣层级信息
  const getDiscountTiers = async () => {
    try {
      const res = await API.get('/api/option/getDiscountTiers');
      const { success, data } = res.data;
      if (success && data && Array.isArray(data)) {
        setDiscountTiers(data);
        // 根据折扣层级更新预设金额
        const amounts = data.map(tier => tier.min_amount || tier.MinAmount);
        if (amounts.length > 0) {
          setPredefinedAmounts(amounts);
          // 设置默认选中金额为第一个，并获取对应的价格
          if (!customAmount) {
            const defaultAmount = amounts[0];
            setSelectedAmount(defaultAmount);
            // 获取默认金额的价格信息
            setTimeout(() => {
              getAmount(defaultAmount);
            }, 100);
          }
        }
        setDiscountTiersLoaded(true);
      } else {
        console.warn('折扣层级数据格式不正确:', data);
        setDiscountTiersLoaded(true);
      }
    } catch (error) {
      console.error('获取折扣层级失败:', error);
      setDiscountTiersLoaded(true);
    }
  };

  // 根据金额获取折扣信息（使用后台数据）
  const getDiscountInfo = (amount) => {
    if (!discountTiersLoaded || !discountTiers.length) {
      return { rate: 1, label: null, tier: null };
    }

    // 按最小金额正序排序，找到刚好满足条件的档位
    const sortedTiers = [...discountTiers].sort((a, b) => {
      const aMin = a.min_amount || a.MinAmount;
      const bMin = b.min_amount || b.MinAmount;
      return aMin - bMin; // 正序排序
    });

    let applicableTier = null;

    // 找到最后一个满足条件的档位
    for (const tier of sortedTiers) {
      const minAmount = tier.min_amount || tier.MinAmount;

      if (amount >= minAmount) {
        applicableTier = tier;
      } else {
        break; // 一旦不满足就跳出
      }
    }

    if (applicableTier) {
      const rate = applicableTier.rate || applicableTier.Rate;
      const discount = Math.round(rate * 100);
      return {
        rate: rate,
        label: discount < 100 ? `${discount}折` : null,
        tier: applicableTier
      };
    }

    return { rate: 1, label: null, tier: null };
  };

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

    // 如果是自定义金额，进行严格验证
    if (customAmount) {
      // 检查是否为空
      if (!topUpCount || topUpCount === '') {
        showError(t('请输入充值金额'));
        return;
      }

      // 检查是否只包含数字
      if (!/^\d+$/.test(topUpCount)) {
        showError(t('充值金额只能输入数字'));
        return;
      }

      const num = parseInt(topUpCount);
      
      // 检查是否为有效数字
      if (isNaN(num)) {
        showError(t('请输入有效的充值金额'));
        return;
      }

      // 检查金额范围
      if (num < 2) {
        showError(t('充值金额不能少于2元'));
        return;
      }

      if (num > 100000) {
        showError(t('充值金额不能超过100000元'));
        return;
      }

      // 确保finalAmount与解析的数字一致（类型安全的比较）
      if (num.toString() !== topUpCount) {
        showError(t('充值金额格式不正确'));
        return;
      }
    }

    await getAmount(finalAmount);
    if (finalAmount < minTopUp) {
      showError(t('充值数量不能小于') + minTopUp);
      return;
    }
    setPayWay(payment);
    setOpen(true);
  };

  const onlineTopUp = async () => {
    // 防止重复提交
    if (paymentLoading) {
      return;
    }

    if (amount <= minTopUp) {
      showError('充值数量不能小于' + minTopUp);
      return;
    }

    if (amount === 0) {
      await getAmount();
    }

    const finalAmount = customAmount ? topUpCount : selectedAmount;

    // 如果是自定义金额，在支付前再次进行严格验证
    if (customAmount) {
      // 检查是否为空
      if (!topUpCount || topUpCount === '') {
        showError(t('请输入充值金额'));
        return;
      }

      // 检查是否只包含数字
      if (!/^\d+$/.test(topUpCount)) {
        showError(t('充值金额只能输入数字'));
        return;
      }

      const num = parseInt(topUpCount);
      
      // 检查是否为有效数字
      if (isNaN(num)) {
        showError(t('请输入有效的充值金额'));
        return;
      }

      // 检查金额范围
      if (num < 2) {
        showError(t('充值金额不能少于2元'));
        return;
      }

      if (num > 100000) {
        showError(t('充值金额不能超过100000元'));
        return;
      }

      // 确保finalAmount是整数
      if (num.toString() !== topUpCount) {
        showError(t('充值金额格式不正确'));
        return;
      }
    }

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
        amount: parseFloat(finalAmount),
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

  // 获取提现状态
  const getWithdrawStatus = async () => {
    try {
      const res = await API.get('/api/user/withdraw_status');
      const { success, data } = res.data;
      if (success) {
        setWithdrawHistory(data.withdraws || []);
      }
    } catch (error) {
      console.error('获取提现状态失败:', error);
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

  // 新增划转和提现相关函数
  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }

    let apiUrl = '/api/user/aff_transfer';
    if (transferType === 'commission') {
      apiUrl = '/api/user/commission_transfer';
    }

    const res = await API.post(apiUrl, {
      quota: transferAmount,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenTransfer(false);
      getUserQuota().then();
      getWithdrawStatus().then();
    } else {
      showError(message);
    }
  };

  const withdraw = async () => {
    if (withdrawAmount < getQuotaPerUnit() * 10) { // 最少十块钱
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
      quota: withdrawAmount,
      alipay_account: withdrawAlipayAccount,
      contact: withdrawContact,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess(message);
      setOpenWithdraw(false);
      setWithdrawAlipayAccount('');
      setWithdrawContact('');
      getUserQuota().then();
      getWithdrawStatus().then();
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
    setWithdrawAmount(getQuotaPerUnit() * 10);
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
    // 获取折扣层级信息
    getDiscountTiers().then();
    getUserQuota().then();
    getAffLink().then();
    getWithdrawStatus().then();
  }, []);

  const renderAmount = () => {
    return amount + ' ' + t('元');
  };

  const getAmount = async (value) => {
    if (value === undefined) {
      value = customAmount ? topUpCount : selectedAmount;
    }

    if (!value || value <= 0) {
      setAmount(0);
      setAmountInfo({ payAmount: 0, creditAmount: 0, discount: 0 });
      return;
    }

    try {
      const res = await API.post('/api/user/amount', {
        amount: parseFloat(value),
        top_up_code: topUpCode,
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          // 假设后端返回的数据格式为 { payAmount, creditAmount, discount }
          if (typeof data === 'object' && data.payAmount !== undefined) {
            setAmount(parseFloat(data.payAmount));
            setAmountInfo({
              payAmount: parseFloat(data.payAmount),
              creditAmount: parseFloat(data.creditAmount || data.payAmount),
              discount: parseFloat(data.discount || 0)
            });
          } else {
            // 兼容旧版本后端，如果返回的是数字
            setAmount(parseFloat(data));
            const discountInfo = getDiscountInfo(value);
            setAmountInfo({
              payAmount: parseFloat(data),
              creditAmount: parseFloat(data),
              discount: discountInfo.rate
            });
          }
        } else {
          setAmount(0);
          setAmountInfo({ payAmount: 0, creditAmount: 0, discount: 0 });
          Toast.error({ content: '错误：' + data, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (err) {
      console.log(err);
      setAmount(0);
      setAmountInfo({ payAmount: 0, creditAmount: 0, discount: 0 });
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleAmountChange = (amount) => {
    if (amount === 'custom') {
      setCustomAmount(true);
      setTopUpCount('2'); // 设置为字符串'2'，符合新的验证要求
      getAmount(2);
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
              {t('原价')}：¥{customAmount ? topUpCount : selectedAmount}
            </p>
            <p>
              {t('实付金额')}：¥{amount}
            </p>
            <p>
              {t('到账额度')}：¥{customAmount ? topUpCount : selectedAmount}
            </p>
            {amount > 0 && amount < (customAmount ? topUpCount : selectedAmount) && (
              <p style={{ color: '#52c41a' }}>
                {t('立省')}：¥{((customAmount ? topUpCount : selectedAmount) - amount).toFixed(2)}
              </p>
            )}
            <p>{t('是否确认充值？')}</p>
          </Modal>

          <Modal
            title={
              <div className="flex items-center font-medium" style={{ color: payWay === 'zfb' ? '#1677FF' : '#09BB07' }}>
                {payWay === 'zfb' ? (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1024 710.044444c0 127.004444-91.022222 218.026667-218.026667 218.026667H218.026667C91.022222 928.071111 0 837.048889 0 710.044444V313.955556C0 186.951111 91.022222 95.928889 218.026667 95.928889h587.946666C933.006222 95.928889 1024 186.951111 1024 313.955556v396.088888z m-83.182222-120.604444c-34.816-13.823791-79.644444-31.175111-136.533334-50.915556 25.543111-43.52 42.666667-102.4 42.666667-164.124444 0-22.755556-1.820444-45.511111-5.688889-67.584H536.120889v56.888889h227.555555c2.275556 13.596444 3.640889 27.42 3.640889 41.699555 0 47.816889-11.719111 93.639111-30.72 130.048-40.96-11.719111-86.755556-24.348444-136.988444-37.205333-89.6-22.983111-138.24-42.211556-138.24-102.4 0-39.822222 32.540444-70.314667 83.2-70.314667 43.52 0 78.336 21.617778 78.336 48.355556h75.662222c0-56.888889-57.571556-98.986667-153.884444-98.986667-85.333333 0-159.971556 51.2-159.971556 124.302223 0 96.995556 75.662222 134.684444 189.667556 164.124444 52.906667 13.596444 99.555556 26.453333 139.150222 38.627556-23.04 31.857778-57.344 59.050667-99.555555 78.791111L512 654.222222l-102.172444-83.655111c-70.542222-31.402667-115.825778-104.732444-115.825778-190.065778 0-113.777778 92.16-205.937778 205.937778-205.937777s205.937778 92.16 205.937777 205.937777c0 35.612444-9.102222 69.006222-25.088 98.304z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M385.28 305.066667c19.2 0 32-12.8 32-29.866667s-12.8-29.866667-32-29.866667c-19.2 0-38.4 12.8-38.4 29.866667s19.2 29.866667 38.4 29.866667z m253.44 0c19.2 0 32-12.8 32-29.866667s-12.8-29.866667-32-29.866667c-19.2 0-38.4 12.8-38.4 29.866667s19.2 29.866667 38.4 29.866667z" fill="currentColor" />
                    <path d="M693.76 456.533333c12.8 0 25.6-12.8 25.6-25.6s-12.8-25.6-25.6-25.6-25.6 12.8-25.6 25.6 12.8 25.6 25.6 25.6z m-179.2 0c12.8 0 25.6-12.8 25.6-25.6s-12.8-25.6-25.6-25.6-25.6 12.8-25.6 25.6 12.8 25.6 25.6 25.6z" fill="currentColor" />
                    <path d="M512 64C264.533333 64 64 264.533333 64 512s200.533333 448 448 448 448-200.533333 448-448S759.466667 64 512 64z m-66.133333 605.866667c-38.4 0-70.4-6.4-108.8-19.2l-108.8 57.6 32-96c-76.8-57.6-121.6-128-121.6-211.2 0-153.6 140.8-275.2 307.2-275.2 151.466667 0 283.733333 102.4 307.2 243.2-32-6.4-66.133333-6.4-98.133334 6.4-19.2-89.6-115.2-160-224-160-128 0-230.4 89.6-230.4 204.8 0 64 32 121.6 83.2 160l-19.2 64 70.4-38.4c25.6 6.4 51.2 12.8 76.8 12.8 12.8 0 25.6 0 38.4-6.4-6.4 19.2-6.4 38.4-6.4 57.6 0 6.4 0 6.4 0 12.8 0-6.4 0-6.4 0-12.8z m320-121.6l57.6 38.4-19.2-70.4c38.4-32 64-76.8 64-121.6 0-96-83.2-172.8-179.2-172.8s-179.2 76.8-179.2 172.8 83.2 172.8 179.2 172.8c25.6 0 51.2-6.4 76.8-19.2z" fill="currentColor" />
                  </svg>
                )}
                {payWay === 'zfb' ? t('支付宝付款') : t('微信支付')} - ¥{amount}
              </div>
            }
            visible={showPaymentModal}
            onCancel={handleClosePaymentModal}
            footer={null}
            maskClosable={false}
            size={'small'}
            centered={true}
            className={payWay === 'zfb' ? 'alipay-payment-modal' : 'wechat-payment-modal'}
          >
            <div className="flex flex-col items-center p-4">
              {paymentLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Spin size="large" style={{ color: payWay === 'zfb' ? "#1677FF" : "#09BB07" }} />
                </div>
              ) : paymentStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="text-6xl mb-4" style={{ color: payWay === 'zfb' ? '#1677FF' : '#09BB07' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-xl font-medium text-gray-800">{t('支付成功')}</p>
                  <p className="text-sm text-gray-500 mt-2">{t('正在处理您的充值...')}</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-5 w-full py-3 rounded-lg border" style={{ 
                    backgroundColor: payWay === 'zfb' ? '#f0f9ff' : '#f0f9f0', 
                    borderColor: payWay === 'zfb' ? '#e6f4ff' : '#e6f6e6' 
                  }}>
                    <p className="text-xl font-semibold mb-1" style={{ color: payWay === 'zfb' ? '#1677FF' : '#09BB07' }}>¥{amount}</p>
                    <p className="text-xs text-gray-500">{t('订单号')}: {outTradeNo}</p>
                    <p className="text-xs text-gray-500">{t('原价')}: ¥{customAmount ? topUpCount : selectedAmount} | {t('到账额度')}: ¥{customAmount ? topUpCount : selectedAmount}</p>
                    {amount > 0 && amount < (customAmount ? topUpCount : selectedAmount) && (
                      <p className="text-xs text-green-600 font-medium">{t('立省')} ¥{((customAmount ? topUpCount : selectedAmount) - amount).toFixed(2)}</p>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-lg border mb-4 flex flex-col items-center" style={{ 
                    borderColor: payWay === 'zfb' ? '#e6f4ff' : '#e6f6e6' 
                  }}>
                    <div className="mb-2 text-sm font-medium" style={{ color: payWay === 'zfb' ? '#1677FF' : '#09BB07' }}>
                      {payWay === 'zfb' ? t('请用支付宝扫码支付') : t('请用微信扫码支付')}
                    </div>

                    {qrCodeUrl ? (
                      <div className="p-3 border rounded-lg" style={{ borderColor: payWay === 'zfb' ? '#1677FF' : '#09BB07' }}>
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

                    <div className="mt-3 flex items-center" style={{ color: payWay === 'zfb' ? '#1677FF' : '#09BB07' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">{formatCountdown(countdown)}</span>
                    </div>
                  </div>

                  <div className="text-center text-xs text-gray-500 max-w-xs px-3">
                    <div className="flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 mr-1" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" style={{ color: payWay === 'zfb' ? '#1677FF' : '#09BB07' }}>
                        <path d="M512 85.333333c-235.52 0-426.666667 191.146667-426.666667 426.666667s191.146667 426.666667 426.666667 426.666667 426.666667-191.146667 426.666667-426.666667-191.146667-426.666667-426.666667-426.666667z m-26.88 640a45.226667 45.226667 0 0 1-45.226667-45.226666 45.226667 45.226667 0 0 1 45.226667-45.226667 45.226667 45.226667 0 0 1 45.226667 45.226667c0 24.746667-20.48 45.226667-45.226667 45.226666z m72.533333-213.333333c-17.066667 6.826667-29.013333 13.653333-36.693333 24.746667-3.413333 6.826667-5.973333 17.92-5.973333 34.986666h-56.32v-14.506666c0-17.066667 3.413333-31.573333 10.24-43.52 6.826667-11.946667 19.626667-24.746667 39.253333-35.84 17.066667-9.386667 29.013333-17.066667 36.693333-26.453334 6.826667-9.386667 10.24-19.626667 10.24-31.573333 0-13.653333-5.12-24.746667-15.36-33.28-10.24-8.533333-23.893333-13.653333-40.96-13.653333-38.4 0-64.853333 25.6-64.853333 66.56h-56.32c1.706667-30.72 11.946667-56.32 29.866666-75.093334 20.48-21.333333 49.493333-31.573333 87.04-31.573333 32.426667 0 58.88 7.68 80.213334 23.04 21.333333 15.36 31.573333 36.693333 31.573333 64.853333 0 13.653333-4.266667 27.306667-11.093333 39.253334-6.826667 11.946667-16.213333 21.333333-37.546667 31.573333z" fill="currentColor"></path>
                      </svg>
                      <span>{t('请不要关闭此窗口')}</span>
                    </div>
                    <p>{payWay === 'zfb' ? t('扫码后请在支付宝中确认付款') : t('扫码后请在微信中确认付款')}</p>
                    <p>{t('付款完成后将自动为您处理订单')}</p>
                  </div>

                  {countdown === 0 && (
                    <div className="mt-4 w-full">
                      <Button
                        type="primary"
                        theme="solid"
                        onClick={() => { setShowPaymentModal(false); setOpen(true); }}
                        className="w-full py-2 hover:opacity-80 border-none"
                        style={{ backgroundColor: payWay === 'zfb' ? "#1677FF" : "#09BB07" }}
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
            title={t('申请提现')}
            visible={openWithdraw}
            onOk={withdraw}
            onCancel={handleWithdrawCancel}
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
                {renderQuotaWithPrompt(withdrawAmount)}{' '}
                {t('最低') + renderQuota(getQuotaPerUnit() * 10)}
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

          {/* 余额显示卡片 */}
          <Card
            style={{
              marginBottom: isMobile() ? 20 : 24,
            }}
          >
            <Title level={3} style={{ color: 'var(--semi-color-text-0)' }}>
              {t('当前余额')}
            </Title>
            <div style={{ fontSize: 24, color: 'var(--semi-color-text-0)' }}>
              {/*{renderQuotaWithAmount(userQuota)}*/}
              {renderQuota(userQuota)}
            </div>
          </Card>



          {/* 在线充值 */}
          <Card
            style={{
              marginBottom: isMobile() ? 20 : 24,
            }}
          >
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <Title level={3} className="!mb-0">{t('在线充值')}</Title>
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {discountTiersLoaded && discountTiers.length > 0
                    ? t('限时福利，阶梯折扣，充值越多越划算')
                    : t('充值越多折扣越大')
                  }
                </div>
              </div>
              <Typography.Text style={{ fontSize: 16, color: '#666' }}>
                {discountTiersLoaded && discountTiers.length > 0
                  ? t('根据充值金额享受不同折扣，最高可享') + ' ' + Math.round((Math.min(...discountTiers.map(tier => tier.rate || tier.Rate))) * 100) + t('折优惠')
                  : t('选择充值金额，享受超值折扣优惠')
                }
              </Typography.Text>
            </div>

            <div className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {predefinedAmounts.map((amount) => {
                  const discountInfo = getDiscountInfo(amount);
                  const isSelected = !customAmount && selectedAmount === amount;
                  // 使用动态折扣计算实际支付金额
                  const estimatedPayAmount = Math.round(amount * discountInfo.rate * 100) / 100;
                  const estimatedSavings = amount - estimatedPayAmount;

                  return (
                    <div
                      key={amount}
                      className={`relative cursor-pointer transition-all duration-300 ${
                        isSelected 
                          ? 'transform scale-105' 
                          : 'hover:transform hover:scale-102'
                      }`}
                      onClick={() => handleAmountChange(amount)}
                    >
                      <div className={`
                        relative bg-white rounded-xl border-2 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-300
                        ${isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-300'
                        }
                      `}>
                        {/* 折扣标签 */}
                        {discountInfo.label && (
                          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                            {discountInfo.label}
                          </div>
                        )}

                        {/* 推荐标签 - 根据折扣层级动态判断 */}
                        {discountInfo.tier && discountInfo.rate <= 0.92 && (
                          <div className="absolute -top-2 -left-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                            {t('推荐')}
                          </div>
                        )}

                        {/* 原价显示 */}
                        <div className="mb-2">
                          <div className="text-xs text-gray-500 mb-1">{t('原价')}</div>
                          <div className={`text-lg font-bold ${estimatedSavings > 0 ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            ¥{amount}
                          </div>
                        </div>

                        {/* 实付金额 - 只有有折扣时才显示 */}
                        {estimatedSavings > 0 && (
                          <div className="mb-2">
                            <div className="text-xs text-gray-500 mb-1">{t('实付')}</div>
                            <div className="text-2xl font-bold text-red-500">
                              ¥{estimatedPayAmount}
                            </div>
                            <div className="text-xs text-green-600 font-medium">
                              {t('立省')} ¥{estimatedSavings.toFixed(2)}
                            </div>
                          </div>
                        )}

                        {/* 到账额度 */}
                        <div className="mb-2">
                          <div className="text-xs text-gray-500 mb-1">{t('到账额度')}</div>
                          <div className="text-lg font-bold text-blue-500">
                            ¥{amount}
                          </div>
                        </div>

                        {/* 选中状态 */}
                        {isSelected && (
                          <div className="mt-2">
                            <div className="w-6 h-6 bg-blue-500 rounded-full mx-auto flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 自定义金额卡片 */}
                <div
                  className={`relative cursor-pointer transition-all duration-300 ${
                    customAmount 
                      ? 'transform scale-105' 
                      : 'hover:transform hover:scale-102'
                  }`}
                  onClick={() => handleAmountChange('custom')}
                >
                  <div className={`
                    relative bg-white rounded-xl border-2 p-4 text-center shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col justify-center
                    ${customAmount 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-purple-300'
                    }
                  `}>
                    <div className="mb-2">
                      <svg className="w-8 h-8 mx-auto text-purple-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <div className="text-lg font-bold text-purple-600">
                        {t('自定义')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {t('输入金额')}
                      </div>
                    </div>

                    {customAmount && (
                      <div className="mt-2">
                        <div className="w-6 h-6 bg-purple-500 rounded-full mx-auto flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 自定义金额输入 */}
            {customAmount && (
                <Card style={{ marginBottom: isMobile() ? 20 : 24 }}>
                  <Form layout='horizontal' style={{ marginTop: 16 }}>
                    <Form.Section text={t('自定义充值金额')}>
                      <Form.Input
                          label={t('充值金额')}
                          placeholder={t('请输入充值金额（2-100000元）')}
                          name='customAmount'
                          value={topUpCount || ''}
                          onChange={(e) => {
                            // 只允许输入数字，过滤其他字符
                            const filteredValue = e.replace(/[^\d]/g, '');
                            setTopUpCount(filteredValue);

                            // 如果有值就调用getAmount，没有值就传0
                            const numValue = filteredValue ? parseInt(filteredValue) : 0;
                            getAmount(numValue);
                          }}
                          onKeyPress={(e) => {
                            // 阻止输入非数字字符
                            if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                              e.preventDefault();
                            }
                          }}
                          onPaste={(e) => {
                            // 阻止粘贴非数字内容
                            const pasteData = e.clipboardData.getData('text');
                            if (!/^\d+$/.test(pasteData)) {
                              e.preventDefault();
                            }
                          }}
                          style={{
                            // 修复暗黑模式下的样式问题
                            backgroundColor: 'var(--semi-color-bg-2)',
                            color: 'var(--semi-color-text-0)'
                          }}
                          prefix='¥'
                          suffix='元'
                          validateStatus={(() => {
                            if (!topUpCount || topUpCount === '') return 'error';

                            // 检查是否只包含数字
                            if (!/^\d+$/.test(topUpCount)) return 'error';

                            const num = parseInt(topUpCount);
                            if (isNaN(num) || num < 2 || num > 100000) return 'error';
                            return 'default';
                          })()}
                          helpText={(() => {
                            if (!topUpCount || topUpCount === '') {
                              return t('请输入2-100000之间的整数金额');
                            }

                            // 检查是否包含非数字字符
                            if (!/^\d+$/.test(topUpCount)) {
                              return t('只能输入数字');
                            }

                            const num = parseInt(topUpCount);
                            if (isNaN(num)) {
                              return t('请输入有效的数字金额');
                            }
                            if (num < 2) {
                              return t('充值金额不能少于2元');
                            }
                            if (num > 100000) {
                              return t('充值金额不能超过100000元');
                            }
                            return '';
                          })()}
                      />

                      {topUpCount && parseInt(topUpCount) >= 2 && parseInt(topUpCount) <= 100000 && amountInfo.payAmount > 0 && (
                          <div style={{ marginTop: 16, padding: 16, backgroundColor: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
                            {/* 使用动态折扣信息显示 */}
                            {(() => {
                              const currentAmount = parseInt(topUpCount);
                              const customDiscountInfo = getDiscountInfo(currentAmount);
                              const estimatedPayAmount = Math.round(currentAmount * customDiscountInfo.rate * 100) / 100;
                              const estimatedSavings = currentAmount - estimatedPayAmount;

                              return (
                                  <>
                                    <div style={{ marginBottom: 8, color: 'var(--semi-color-text-1)' }}>
                                      {t('原价')}: ¥{currentAmount} | {t('实付')}: ¥{amountInfo.payAmount} | {t('到账额度')}: ¥{amountInfo.creditAmount}
                                    </div>
                                    {/* 显示适用的折扣信息 */}
                                    {customDiscountInfo.label && (
                                        <div style={{ marginBottom: 8, color: 'var(--semi-color-success)' }}>
                                          {t('适用折扣')}: {customDiscountInfo.label}
                                        </div>
                                    )}

                                    {amountInfo.payAmount < currentAmount && (
                                        <div style={{ color: 'var(--semi-color-danger)' }}>
                                          {t('立省')} ¥{(currentAmount - amountInfo.payAmount).toFixed(2)}
                                        </div>
                                    )}
                                  </>
                              );
                            })()}
                          </div>
                      )}
                    </Form.Section>
                  </Form>
                </Card>
            )}

            {/* 支付按钮 */}
            <div className="text-center">
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="text-lg font-bold text-gray-800 mb-1">
                  {t('订单信息')}
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-600">{t('支付金额')}</div>
                    <div className="text-2xl font-bold text-red-600">
                      ¥{amount || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{t('到账额度')}</div>
                    <div className="text-2xl font-bold text-green-600">
                      ¥{amountInfo.creditAmount || (customAmount ? topUpCount : selectedAmount)}
                    </div>
                  </div>
                </div>
                {amount > 0 && amount < (customAmount ? topUpCount : selectedAmount) && (
                  <div className="text-sm text-green-600 font-medium mt-2">
                    {t('立省')} ¥{((customAmount ? topUpCount : selectedAmount) - amount).toFixed(2)}
                  </div>
                )}
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  theme='solid'
                  type={'primary'}
                  size='large'
                  loading={paymentLoading && payWay === 'zfb'}
                  onClick={() => preTopUp('zfb')}
                  disabled={!amount || amount <= 0 || paymentLoading}
                  className="min-w-[140px]"
                  icon={
                    <svg
                      t="1687765525122"
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                    >
                      <path d="M1024 710.044444c0 127.004444-91.022222 218.026667-218.026667 218.026667H218.026667C91.022222 928.071111 0 837.048889 0 710.044444V313.955556C0 186.951111 91.022222 95.928889 218.026667 95.928889h587.946666C933.006222 95.928889 1024 186.951111 1024 313.955556v396.088888z m-83.182222-120.604444c-34.816-13.823791-79.644444-31.175111-136.533334-50.915556 25.543111-43.52 42.666667-102.4 42.666667-164.124444 0-22.755556-1.820444-45.511111-5.688889-67.584H536.120889v56.888889h227.555555c2.275556 13.596444 3.640889 27.42 3.640889 41.699555 0 47.816889-11.719111 93.639111-30.72 130.048-40.96-11.719111-86.755556-24.348444-136.988444-37.205333-89.6-22.983111-138.24-42.211556-138.24-102.4 0-39.822222 32.540444-70.314667 83.2-70.314667 43.52 0 78.336 21.617778 78.336 48.355556h75.662222c0-56.888889-57.571556-98.986667-153.884444-98.986667-85.333333 0-159.971556 51.2-159.971556 124.302223 0 96.995556 75.662222 134.684444 189.667556 164.124444 52.906667 13.596444 99.555556 26.453333 139.150222 38.627556-23.04 31.857778-57.344 59.050667-99.555555 78.791111L512 654.222222l-102.172444-83.655111c-70.542222-31.402667-115.825778-104.732444-115.825778-190.065778 0-113.777778 92.16-205.937778 205.937778-205.937777s205.937778 92.16 205.937777 205.937777c0 35.612444-9.102222 69.006222-25.088 98.304z" fill="currentColor" />
                    </svg>
                  }
                >
                  {t('支付宝支付')}
                </Button>
                <Button
                  theme='solid'
                  type={'secondary'}
                  size='large'
                  loading={paymentLoading && payWay === 'wx'}
                  onClick={() => preTopUp('wx')}
                  disabled={!amount || amount <= 0 || paymentLoading}
                  className="min-w-[140px]"
                  icon={
                    <svg
                      t="1687765533353"
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                    >
                      <path d="M385.28 305.066667c19.2 0 32-12.8 32-29.866667s-12.8-29.866667-32-29.866667c-19.2 0-38.4 12.8-38.4 29.866667s19.2 29.866667 38.4 29.866667z m253.44 0c19.2 0 32-12.8 32-29.866667s-12.8-29.866667-32-29.866667c-19.2 0-38.4 12.8-38.4 29.866667s19.2 29.866667 38.4 29.866667z" fill="currentColor" />
                      <path d="M693.76 456.533333c12.8 0 25.6-12.8 25.6-25.6s-12.8-25.6-25.6-25.6-25.6 12.8-25.6 25.6 12.8 25.6 25.6 25.6z m-179.2 0c12.8 0 25.6-12.8 25.6-25.6s-12.8-25.6-25.6-25.6-25.6 12.8-25.6 25.6 12.8 25.6 25.6 25.6z" fill="currentColor" />
                      <path d="M512 64C264.533333 64 64 264.533333 64 512s200.533333 448 448 448 448-200.533333 448-448S759.466667 64 512 64z m-66.133333 605.866667c-38.4 0-70.4-6.4-108.8-19.2l-108.8 57.6 32-96c-76.8-57.6-121.6-128-121.6-211.2 0-153.6 140.8-275.2 307.2-275.2 151.466667 0 283.733333 102.4 307.2 243.2-32-6.4-66.133333-6.4-98.133334 6.4-19.2-89.6-115.2-160-224-160-128 0-230.4 89.6-230.4 204.8 0 64 32 121.6 83.2 160l-19.2 64 70.4-38.4c25.6 6.4 51.2 12.8 76.8 12.8 12.8 0 25.6 0 38.4-6.4-6.4 19.2-6.4 38.4-6.4 57.6 0 6.4 0 6.4 0 12.8 0-6.4 0-6.4 0-12.8z m320-121.6l57.6 38.4-19.2-70.4c38.4-32 64-76.8 64-121.6 0-96-83.2-172.8-179.2-172.8s-179.2 76.8-179.2 172.8 83.2 172.8 179.2 172.8c25.6 0 51.2-6.4 76.8-19.2z" fill="currentColor" />
                    </svg>
                  }
                >
                  {t('微信支付')}
                </Button>
              </div>

              {topUpLink && (
                <div style={{ marginTop: 16 }}>
                  <Button onClick={openTopUpLink} type="tertiary">
                    {t('通过充值链接充值')}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* 兑换码充值 */}
          <Card
              style={{
                marginBottom: isMobile() ? 20 : 24,
              }}
          >
            <Title level={3}>{t('兑换')}</Title>
            <div style={{ marginTop: 10 }}>
              <Typography.Text style={{ fontSize: 16 }}>
                {t('请输入充值卡密进行充值')}
              </Typography.Text>
            </div>
            <div style={{ marginTop: 20 }}>
              <Form layout='horizontal' style={{ marginTop: 16 }}>
                <Form.Section text={t('兑换卡密')}>
                  <Form.Input
                      label={t('卡密')}
                      placeholder={t('请输入卡密')}
                      name='redemptionCode'
                      value={redemptionCode}
                      onChange={(e) => setRedemptionCode(e)}
                  />
                  <Button
                      theme='solid'
                      type={'primary'}
                      htmlType={'submit'}
                      size='large'
                      loading={isSubmitting}
                      onClick={topUp}
                  >
                    {t('兑换')}
                  </Button>
                </Form.Section>
              </Form>
            </div>
          </Card>

          {/* 邀请返利模块 - 高对比度版本 */}
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-3xl">
              {/* 标题和返利比例 */}
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl inline-flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 my-auto">{t('邀请返利')}</h2>
                </div>
                <div className="inline-flex items-center bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-2 rounded-full shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-sm font-bold text-white ml-2 my-auto">{t('返利比例')}: 2%</span>
                </div>
              </div>

              {/* 邀请说明 - 高对比度 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 border-2 border-blue-700 rounded-xl p-5 mb-6 shadow-lg">
                <p className="text-white font-medium leading-relaxed text-center">
                  {t('邀请好友注册，您和好友都可立得 $0.3 额度，可直接使用。好友每次充值，您将获得2%返现，返现金额可转账、可提现，轻松变现无门槛。邀请越多，赚得越多，立即邀请好友开启躺赚模式！')}
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
                        <h3 className="text-xl font-bold text-gray-900 my-auto">{t('邀请奖励')}</h3>
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
                          <div className="inline-flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="ml-2 my-auto">{t('划转')}</span>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 邀请返利卡片 - 高对比度 */}
                <div className="bg-white rounded-xl border-2 border-gray-300 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="inline-flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-violet-700 rounded-xl inline-flex items-center justify-center shadow-md">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 my-auto">{t('邀请充值返利')}</h3>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('待使用收益')}</span>
                        <span className="text-xl font-bold text-purple-700">
                          {renderQuota(((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0)) - (userState?.user?.withdrawing_quota || 0))}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('正在提现收益')}</span>
                        <span className="text-xl font-bold text-purple-700">
                          {renderQuota(userState?.user?.withdrawing_quota || 0)}
                        </span>
                      </div>

                      {/* 查看提现记录按钮 */}
                      <div className="py-2">
                        <Button
                          type="tertiary"
                          theme="light"
                          size="small"
                          onClick={() => setShowWithdrawHistory(true)}
                          className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                        >
                          <div className="inline-flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{t('查看提现记录')}</span>
                          </div>
                        </Button>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{t('总收益')}</span>
                        <span className="text-sm font-bold text-gray-900">
                          {renderQuota(userState?.user?.reward_quota || 0)}
                        </span>
                      </div>

                      <div className="pt-3 space-y-3">
                        <Button
                          type="primary"
                          theme="solid"
                          onClick={() => openTransferModal('commission')}
                          disabled={((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0)) <= 0}
                          className="w-full py-3 text-white font-bold rounded-xl border-2 transition-all duration-200"
                          style={{
                            backgroundColor: '#7c3aed',
                            borderColor: '#7c3aed',
                            opacity: (((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0)) <= 0) ? 0.6 : 1
                          }}
                        >
                          <div className="inline-flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="ml-2 my-auto">{t('划转')}</span>
                          </div>
                        </Button>
                        <Button
                          type="tertiary"
                          theme="solid"
                          onClick={openWithdrawModal}
                          disabled={((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0) - (userState?.user?.withdrawing_quota || 0)) < getQuotaPerUnit() * 10}
                          className="w-full py-3 text-white font-bold rounded-xl border-2 transition-all duration-200"
                          style={{
                            backgroundColor: '#ea580c',
                            borderColor: '#ea580c',
                            opacity: (((userState?.user?.reward_quota || 0) - (userState?.user?.withdrawed_quota || 0) - (userState?.user?.withdrawing_quota || 0)) < getQuotaPerUnit() * 10) ? 0.6 : 1
                          }}
                        >
                          <div className="inline-flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="ml-2 my-auto">{t('提现')}</span>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* 邀请信息 - 与其他卡片保持一致的样式 */}
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
                      <label className="block text-sm font-bold text-gray-700 mb-3">
                        {t('邀请码')}: <span className="text-blue-800 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md font-medium">{affCode || 'Loading...'}</span>
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
            </div>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default TopUp;
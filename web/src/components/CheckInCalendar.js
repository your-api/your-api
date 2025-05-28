import React, { useState, useEffect } from 'react';
import { API, showError, showSuccess } from '../helpers';
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import ImageCaptcha from './ImageCaptcha';

const CheckInCalendar = () => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showImageCaptcha, setShowImageCaptcha] = useState(false);
  const [imageCaptchaData, setImageCaptchaData] = useState(null);

  // 获取签到状态
  const fetchCheckInStatus = async () => {
    try {
      const res = await API.get('/api/user/check_in/status');
      if (res.data.success) {
        setCheckInStatus(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('获取签到状态失败'));
    }
  };

  // 获取日历数据
  const fetchCalendarData = async (year, month) => {
    try {
      const res = await API.get(`/api/user/check_in/calendar?year=${year}&month=${month}`);
      if (res.data.success) {
        setCalendarData(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('获取日历数据失败'));
    }
  };

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const res = await API.get('/api/user/check_in/stats');
      if (res.data.success) {
        setStats(res.data.data);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('获取统计信息失败'));
    }
  };

  // 处理图片验证码验证成功
  const handleImageCaptchaVerified = async (captchaData) => {
    setImageCaptchaData(captchaData);
    setShowImageCaptcha(false);
    await performCheckIn(captchaData);
  };

  // 图片验证码验证失败或错误
  const handleImageCaptchaError = (error) => {
    console.error('图片验证码错误:', error);
    setImageCaptchaData(null);
    setShowImageCaptcha(true);
  };

  // 执行签到
  const performCheckIn = async (captchaData) => {
    if (!checkInStatus?.can_check_in) return;

    setCheckingIn(true);
    try {
      const res = await API.post('/api/user/check_in', {
        image_captcha_id: captchaData.captcha_id,
        image_captcha_code: captchaData.captcha_code
      });
      if (res.data.success) {
        showSuccess(
          `${t('签到成功')}！${t('获得奖励')}: ${res.data.data.quota_reward_text}，${t('连续签到')}: ${res.data.data.consecutive_days} ${t('天')}`
        );
        // 刷新数据
        await Promise.all([
          fetchCheckInStatus(),
          fetchCalendarData(currentDate.getFullYear(), currentDate.getMonth() + 1),
          fetchStats()
        ]);
      } else {
        showError(res.data.message);
        // 如果是验证码错误，重新显示验证码
        if (res.data.message.includes('图片验证码') || res.data.message.includes('验证码错误') || res.data.message.includes('已过期')) {
          setShowImageCaptcha(true);
        }
      }
    } catch (error) {
      showError(t('签到失败'));
      setShowImageCaptcha(true);
    } finally {
      setCheckingIn(false);
    }
  };

  // 签到按钮点击处理
  const handleCheckIn = () => {
    if (!checkInStatus?.can_check_in) return;
    setShowImageCaptcha(true);
  };

  // 切换月份
  const changeMonth = async (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
    await fetchCalendarData(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCheckInStatus(),
        fetchCalendarData(currentDate.getFullYear(), currentDate.getMonth() + 1),
        fetchStats()
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  // 生成日历布局
  const generateCalendarLayout = () => {
    if (!calendarData.length) return [];

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const calendarMap = {};
    calendarData.forEach(day => {
      calendarMap[day.date] = day;
    });

    const weeks = [];
    let currentWeek = [];

    // 填充月初空白
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // 填充月份天数
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = calendarMap[dateStr] || {
        date: dateStr,
        has_check_in: false,
        quota_reward: 0,
        is_today: false
      };

      currentWeek.push({
        day,
        ...dayData
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 填充月末空白
    while (currentWeek.length < 7 && currentWeek.length > 0) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const weeks = generateCalendarLayout();
  const weekDays = [t('日'), t('一'), t('二'), t('三'), t('四'), t('五'), t('六')];

  // 获取连续签到奖励说明
  const getBonusDescription = (days) => {
    if (days >= 30) return '3.0x';
    if (days >= 21) return '2.5x';
    if (days >= 14) return '2.0x';
    if (days >= 7) return '1.5x';
    if (days >= 3) return '1.2x';
    return '1.0x';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">{t('总签到天数')}</p>
              <p className="text-2xl font-bold text-blue-900">{stats?.total_check_in_days || 0}</p>
            </div>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">{t('连续签到')}</p>
              <p className="text-2xl font-bold text-green-900">{checkInStatus?.consecutive_days || 0}</p>
              <p className="text-xs text-green-600">{t('加成')}: {getBonusDescription(checkInStatus?.consecutive_days || 0)}</p>
            </div>
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">{t('总收益')}</p>
              <p className="text-2xl font-bold text-purple-900">{stats?.total_quota_text || '$0.00'}</p>
            </div>
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">{t('本月签到')}</p>
              <p className="text-2xl font-bold text-orange-900">{checkInStatus?.this_month_check_ins || 0}</p>
            </div>
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 签到按钮和下次奖励 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('每日签到')}</h3>
            <p className="text-gray-600">
              {checkInStatus?.has_checked_in_today 
                ? t('今天已签到，明天再来！') 
                : `${t('下次奖励')}: ${checkInStatus?.next_reward_text || '$0.00'} (${t('加成')}: ${getBonusDescription((checkInStatus?.consecutive_days || 0) + 1)})`
              }
            </p>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={!checkInStatus?.can_check_in || checkingIn}
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
              checkInStatus?.can_check_in && !checkingIn
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {checkingIn ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('签到中...')}
              </div>
            ) : checkInStatus?.has_checked_in_today ? (
              t('已签到')
            ) : (
              t('立即签到')
            )}
          </button>
        </div>
      </div>

      {/* 日历组件 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* 日历头部 */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-white rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <h2 className="text-xl font-semibold text-gray-900">
              {currentDate.getFullYear()}{t('年')} {currentDate.getMonth() + 1}{t('月')}
            </h2>
            
            <button
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-white rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {weekDays.map((day, index) => (
            <div key={index} className="p-3 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* 日历主体 */}
        <div className="p-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <div key={dayIndex} className="aspect-square p-2"></div>;
                }

                const isToday = day.is_today;
                const hasCheckedIn = day.has_check_in;

                return (
                  <div
                    key={dayIndex}
                    className={`aspect-square p-2 rounded-lg border-2 transition-all duration-200 ${
                      isToday
                        ? 'border-blue-400 bg-blue-50'
                        : hasCheckedIn
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-100 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="h-full flex flex-col items-center justify-center relative">
                      <span className={`text-sm font-medium ${
                        isToday ? 'text-blue-700' : hasCheckedIn ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        {day.day}
                      </span>
                      
                      {hasCheckedIn && (
                        <div className="mt-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday ? 'bg-blue-500' : 'bg-green-500'
                          }`}>
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          {day.quota_reward_text && (
                            <div className="text-xs text-green-600 mt-1 text-center leading-tight">
                              {day.quota_reward_text}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {isToday && !hasCheckedIn && (
                        <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 签到规则说明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('签到规则')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              {t('每日签到可随机获得 0.1~0.5 额度')}
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              {t('连续签到 3-6 天：1.2倍加成')}
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              {t('连续签到 7-13 天：1.5倍加成')}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
              {t('连续签到 14-20 天：2.0倍加成')}
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              {t('连续签到 21-29 天：2.5倍加成')}
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
              {t('连续签到 30+ 天：3.0倍加成')}
            </div>
          </div>
        </div>
      </div>

      {/* 图片验证码模态框 */}
      <Modal
        title={t('请完成图片验证码验证')}
        visible={showImageCaptcha}
        onCancel={() => setShowImageCaptcha(false)}
        footer={null}
        width={400}
        centered
      >
        <div style={{ padding: '20px 0' }}>
          <p style={{ marginBottom: '20px', textAlign: 'center', color: '#666' }}>
            {t('为了防止恶意操作，请先完成图片验证码验证')}
          </p>
          <ImageCaptcha
            onVerified={handleImageCaptchaVerified}
            onError={handleImageCaptchaError}
            style={{ display: 'flex', justifyContent: 'center' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default CheckInCalendar; 
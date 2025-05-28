import React from 'react';
import CheckInCalendar from '../../components/CheckInCalendar';
import { useTranslation } from 'react-i18next';

const CheckInPage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 text-center">
            {t('每日签到')}
          </h1>
          <p className="text-gray-600 text-center mt-2">
            {t('每日签到获得额度奖励，连续签到获得更多加成')}
          </p>
        </div>
        <CheckInCalendar />
      </div>
    </div>
  );
};

export default CheckInPage; 
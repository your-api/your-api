import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import HeaderBar from './components/layout/HeaderBar';
import './index.css';
import './topup-styles.css';
import { UserProvider } from './context/User';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { StatusProvider } from './context/Status';
import { Layout } from '@douyinfe/semi-ui';
import SiderBar from './components/layout/SiderBar';
import { ThemeProvider } from './context/Theme';
import FooterBar from './components/layout/Footer';
import { StyleContextProvider as StyleProvider } from './context/Style/index.js';
import PageLayout from './components/layout/PageLayout';
import './i18n/i18n';
import { Provider } from 'react-redux';
import { LocaleProvider } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';

// 欢迎信息（二次开发者未经允许不准将此移除）
// Welcome message (Do not remove this without permission from the original developer)
if (typeof window !== 'undefined') {
  console.log('%cWE ❤ NEWAPI%c Github: https://github.com/QuantumNous/new-api',
    'color: #10b981; font-weight: bold; font-size: 24px;',
    'color: inherit; font-size: 14px;');
}

function SemiLocaleWrapper({ children }) {
  const { i18n } = useTranslation();
  const semiLocale = React.useMemo(
    () => ({ zh: zh_CN, en: en_GB }[i18n.language] || zh_CN),
    [i18n.language],
  );
  return <LocaleProvider locale={semiLocale}>{children}</LocaleProvider>;
}

// initialization
import store from './store';

const root = ReactDOM.createRoot(document.getElementById('root'));
const { Sider, Content, Header, Footer } = Layout;
root.render(
    <Provider store={store}>
        <StatusProvider>
            <UserProvider>
                <BrowserRouter>
                    <ThemeProvider>
                        <StyleProvider>
                            <PageLayout />
                        </StyleProvider>
                    </ThemeProvider>
                </BrowserRouter>
            </UserProvider>
        </StatusProvider>
    </Provider>

);

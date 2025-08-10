import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import HeaderBar from './components/layout/HeaderBar';
import './index.css';
import { UserProvider } from './context/User';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { StatusProvider } from './context/Status';
import { Layout } from '@douyinfe/semi-ui';
import SiderBar from './components/layout/SiderBar';
import { ThemeProvider } from './context/Theme';
import FooterBar from './components/layout/Footer';
import { StyleContextProvider as StyleProvider } from './context/Style/index.js';
import PageLayout from './components/layout/PageLayout.js';
import './i18n/i18n.js';
import {Provider} from 'react-redux'
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

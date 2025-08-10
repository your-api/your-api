import React, { lazy, Suspense, useContext, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Loading from './components/common/ui/Loading';
import User from './pages/User';
import { PrivateRoute } from './helpers';
import RegisterForm from './components/auth/RegisterForm';
import LoginForm from './components/LoginForm';
import NotFound from './pages/NotFound';
import Setting from './pages/Setting';
import EditUser from './pages/User/EditUser';
import PasswordResetForm from './components/auth/PasswordResetForm';
import PasswordResetConfirm from './components/auth/PasswordResetConfirm';
import Channel from './pages/Channel';
import Token from './pages/Token';
import EditChannel from './pages/Channel/EditChannel';
import Redemption from './pages/Redemption';
import TopUp from './pages/TopUp';
import Log from './pages/Log';
import Chat from './pages/Chat';
import Chat2Link from './pages/Chat2Link';
import { Layout } from '@douyinfe/semi-ui';
import Midjourney from './pages/Midjourney';
import Pricing from './pages/Pricing/index.js';
import Prices from './pages/Prices/index.js';
import Task from './pages/Task/index.js';
import ModelPage from './pages/Model/index.js';
import Playground from './pages/Playground/index.js';
import OAuth2Callback from './components/auth/OAuth2Callback.js';
import PersonalSetting from './components/settings/PersonalSetting.js';
import Setup from './pages/Setup/index.js';
import SetupCheck from './components/layout/SetupCheck.js';

const Home = lazy(() => import('./pages/Home'));
const Detail = lazy(() => import('./pages/Detail'));
const Contact = lazy(() => import('./pages/About'));
const Document = lazy(() => import('./pages/Document'));

function App() {
  const location = useLocation();

  return (
    <SetupCheck>
      <Routes>
        <Route
          path='/'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path='/setup'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Setup />
            </Suspense>
          }
        />
        <Route
          path='/console'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Detail />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/models'
          element={
            <PrivateRoute>
              <ModelPage />
            </PrivateRoute>
          }
        />
        <Route
          path='/console/channel'
          element={
            <PrivateRoute>
              <Channel />
            </PrivateRoute>
          }
        />
        <Route
          path='/console/channel/edit/:id'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <EditChannel />
            </Suspense>
          }
        />
        <Route
          path='/console/channel/add'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <EditChannel />
            </Suspense>
          }
        />
        <Route
          path='/console/token'
          element={
            <PrivateRoute>
              <Token />
            </PrivateRoute>
          }
        />
        <Route
          path='/console/playground'
          element={
            <PrivateRoute>
              <Playground />
            </PrivateRoute>
          }
        />
        <Route
          path='/console/redemption'
          element={
            <PrivateRoute>
              <Redemption />
            </PrivateRoute>
          }
        />
        <Route
          path='/console/user'
          element={
            <PrivateRoute>
              <User />
            </PrivateRoute>
          }
        />
        <Route
          path='/console/user/edit/:id'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <EditUser />
            </Suspense>
          }
        />
        <Route
          path='/console/user/edit'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <EditUser />
            </Suspense>
          }
        />
        <Route
          path='/user/reset'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <PasswordResetConfirm />
            </Suspense>
          }
        />
        <Route
          path='/login'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <LoginForm />
            </Suspense>
          }
        />
        <Route
          path='/register'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <RegisterForm />
            </Suspense>
          }
        />
        <Route
          path='/reset'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <PasswordResetForm />
            </Suspense>
          }
        />
        <Route
          path='/oauth/github'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <OAuth2Callback type='github'></OAuth2Callback>
            </Suspense>
          }
        />
        <Route
          path='/oauth/oidc'
          element={
            <Suspense fallback={<Loading></Loading>}>
              <OAuth2Callback type='oidc'></OAuth2Callback>
            </Suspense>
          }
        />
        <Route
          path='/oauth/linuxdo'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <OAuth2Callback type='linuxdo'></OAuth2Callback>
            </Suspense>
          }
        />
        <Route
          path='/console/setting'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Setting />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/personal'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <PersonalSetting />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/topup'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <TopUp />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/log'
          element={
            <PrivateRoute>
              <Log />
            </PrivateRoute>
          }
        />
        <Route
          path='/detail'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Detail />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/midjourney'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Midjourney />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/task'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Task />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/pricing'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Pricing />
            </Suspense>
          }
        />
        <Route
          path='/prices'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Prices />
            </Suspense>
          }
        />
        <Route
          path='/docs'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Document />
            </Suspense>
          }
        />
        <Route
          path='/about'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Contact />
            </Suspense>
          }
        />
        <Route
          path='/chat/:id?'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Chat />
            </Suspense>
          }
        />
        <Route
          path='/console/chat/:id?'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Chat />
            </Suspense>
          }
        />
        {/* 方便使用chat2link直接跳转聊天... */}
        <Route
          path='/chat2link'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Chat2Link />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </SetupCheck>
  );
}

export default App;

import { getUserIdFromLocalStorage, showError } from './utils';
import axios from 'axios';

export let API = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
    ? import.meta.env.VITE_REACT_APP_SERVER_URL
    : '',
  headers: {
    'Cache-Control': 'no-store',
  },
});

// 请求拦截器：动态设置New-API-User头部
API.interceptors.request.use(
  (config) => {
    const userId = getUserIdFromLocalStorage();
    if (userId && userId !== -1) {
      config.headers['New-API-User'] = userId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理401错误和用户信息恢复
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      try {
        const userInfoResponse = await axios.get('/api/user/recovery', {
          baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
            ? import.meta.env.VITE_REACT_APP_SERVER_URL
            : '',
          headers: {
            'Cache-Control': 'no-store',
          },
          withCredentials: true,
        });
        
        if (userInfoResponse.data && userInfoResponse.data.success && userInfoResponse.data.data) {
          localStorage.setItem('user', JSON.stringify(userInfoResponse.data.data));
          console.log('用户信息已从session恢复到localStorage');
          
          const originalRequest = error.config;
          originalRequest.headers['New-API-User'] = userInfoResponse.data.data.id;
          return API.request(originalRequest);
        }
      } catch (recoveryError) {
        console.log('无法从session恢复用户信息，需要重新登录');
      }
    }
    
    showError(error);
    return Promise.reject(error);
  },
);

export function updateAPI() {
  API = axios.create({
    baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
      ? import.meta.env.VITE_REACT_APP_SERVER_URL
      : '',
    headers: {
      'Cache-Control': 'no-store',
    },
  });

  // 重新设置拦截器
  API.interceptors.request.use(
    (config) => {
      const userId = getUserIdFromLocalStorage();
      if (userId && userId !== -1) {
        config.headers['New-API-User'] = userId;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  API.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response && error.response.status === 401) {
        try {
          const userInfoResponse = await axios.get('/api/user/recovery', {
            baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
              ? import.meta.env.VITE_REACT_APP_SERVER_URL
              : '',
            headers: {
              'Cache-Control': 'no-store',
            },
            withCredentials: true,
          });
          
          if (userInfoResponse.data && userInfoResponse.data.success && userInfoResponse.data.data) {
            localStorage.setItem('user', JSON.stringify(userInfoResponse.data.data));
            console.log('用户信息已从session恢复到localStorage');
            
            const originalRequest = error.config;
            originalRequest.headers['New-API-User'] = userInfoResponse.data.data.id;
            return API.request(originalRequest);
          }
        } catch (recoveryError) {
          console.log('无法从session恢复用户信息，需要重新登录');
        }
      }
      
      showError(error);
      return Promise.reject(error);
    },
  );
}

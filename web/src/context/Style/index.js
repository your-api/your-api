import React, { createContext, useReducer } from 'react';

const initialState = {
  showSider: true,
  isMobile: window.innerWidth <= 768,
  innerPadding: true,
};

const StyleContext = createContext(initialState);

const styleReducer = (state, action) => {
  switch (action.type) {
    case 'SET_SIDER':
      return { ...state, showSider: action.payload };
    case 'SET_MOBILE':
      return { ...state, isMobile: action.payload };
    case 'SET_INNER_PADDING':
      return { ...state, innerPadding: action.payload };
    default:
      return state;
  }
};

const StyleContextProvider = ({ children }) => {
  const [state, dispatch] = useReducer(styleReducer, initialState);

  // Update isMobile state on window resize
  React.useEffect(() => {
    const handleResize = () => {
      dispatch({ type: 'SET_MOBILE', payload: window.innerWidth <= 768 });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <StyleContext.Provider value={[state, dispatch]}>
      {children}
    </StyleContext.Provider>
  );
};

export { StyleContext, StyleContextProvider };
export default StyleContext;
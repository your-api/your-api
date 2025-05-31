import { createSlice } from '@reduxjs/toolkit';
import {API} from "../../helpers/index.js";

const providerStore = createSlice({
    name: 'providers',
    initialState: {
        // 模型提供
        providers: [],
        // 优点
        advantages: [],
        priceRatio: 7.3,
        systemName: 'Your API',
        typingList: [],
        modelDiscriptions: {},
        custemNavLinks: [],
        // 折扣层级
        discountTiers: []
    },
    reducers: {
        setProviders(state, action) {
            // 设置模型提供
            state.providers = action.payload.providers;
        },
        setAdvantages(state, action) {
            // 设置模型提供
            state.advantages = action.payload.advantages;
        },
        setTypingList(state, action) {
            // 设置模型提供
            state.typingList = action.payload.typingList;
        },
        setPriceRatio(state, action) {
            // 设置模型提供
            state.priceRatio = action.payload.priceRatio;
        },
        setSystemName(state, action) {
            // 设置模型提供
            state.systemName = action.payload.systemName;
        },
        setModelDescription(state, action) {
            console.log("setModelDescription",action.payload.modelDiscriptions)
            // 设置模型提供
            state.modelDiscriptions = action.payload.modelDiscriptions;
        },
        setCustemNavLinks(state, action) {
            // 设置模型提供
            state.custemNavLinks = action.payload.custemNavLinks;
        },
        setDiscountTiers(state, action) {
            // 设置折扣层级
            state.discountTiers = action.payload.discountTiers;
        }
    }
})

const {setProviders,
    setAdvantages,
    setPriceRatio,
    setTypingList,
    setSystemName,
    setCustemNavLinks,
    setModelDescription,
    setDiscountTiers
} = providerStore.actions;

const updateProviders = (payload) => {
    return async dispatch => {
        try {
            console.log("key",{key: "Providers", value: payload.providers})
            // 设置模型提供
            const res = await API.put('/api/option/', {key: "Providers", value: JSON.stringify(payload.Providers)});
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setProviders({ providers: payload.providers }));
            }
        } catch (error) {
            console.error("保存失败:", error);
        }
    }
}

const fetchProviders = () => {
    return async dispatch => {
        try {
            const res = await API.get('/api/option/getModelProviders');
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setProviders({ providers: data }));
            }
        } catch (error) {
            console.error("获取providers失败:", error);
        }
    }
}

const updateCustemNavLinks = (payload) => {
    return async dispatch => {
        try {
            // 设置模型提供
            const res = await API.put('/api/option/', {key: "custemNavLinks", value: JSON.stringify(payload.custemNavLinks)});
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setCustemNavLinks({ custemNavLinks: payload.custemNavLinks }));
            }
        } catch (error) {
            console.error("保存失败:", error);
        }
    }
}

const fetchCustemNavLinks = () => {
    return async dispatch => {
        try {
            const res = await API.get('/api/option/getCustomNavLinks');
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setCustemNavLinks({ custemNavLinks: data }));
            }
        } catch (error) {
            console.error("获取providers失败:", error);
        }
    }
}

const updateTypingList = (payload) => {
    return async dispatch => {
        try {
            // 设置模型提供
            const res = await API.put('/api/option/', {key: "TypingList", value: JSON.stringify(payload.TypingList)});
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setTypingList({ typingList: payload.typingList }));
            }
        } catch (error) {
            console.error("保存失败:", error);
        }
    }
}

const fetchTypingList = () => {
    return async dispatch => {
        try {
            const res = await API.get('/api/option/getTypingList');
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setTypingList({ typingList: data }));
            }
        } catch (error) {
            console.error("获取providers失败:", error);
        }
    }
}

const updateModelDiscriptions = (payload) => {
    return async dispatch => {
        try {
            // 设置模型提供
            const res = await API.put('/api/option/', {key: "ModelDescriptions", value: JSON.stringify(payload.ModelDescriptions)});
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setModelDescription({ modelDiscriptions: payload.ModelDescriptions }));
            }
        } catch (error) {
            console.error("保存失败:", error);
        }
    }
}

const updateAdvantages = (payload) => {
    return async dispatch => {
        try {
            // 设置模型提供
            const res = await API.put('/api/option/', {key: "Advantages", value: JSON.stringify(payload.Advantages)});
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setAdvantages({ advantages: payload.advantages }));
            }
        } catch (error) {
            console.error("保存失败:", error);
        }
    }
}

const fetchAdvantages = () => {
    return async dispatch => {
        try {
            const res = await API.get('/api/option/getAdvantages');
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setAdvantages({ advantages: data }));
            }
        } catch (error) {
            console.error("获取providers失败:", error);
        }
    }
}

const fetchModelDiscriptions = () => {
    return async dispatch => {
        try {
            const res = await API.get('/api/option/getModelDescriptions');
            const { success, message, data } = res.data;
            if (success) {
                console.log(data);
                dispatch(setModelDescription({ modelDiscriptions: data }));
            }
        } catch (error) {
            console.error("获取providers失败:", error);
        }
    }
}

const updateDiscountTiers = (payload) => {
    return async dispatch => {
        try {
            // 设置折扣层级
            const res = await API.put('/api/option/', {key: "UpdateDiscountTiers", value: JSON.stringify(payload.UpdateDiscountTiers)});
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setDiscountTiers({ discountTiers: payload.UpdateDiscountTiers }));
            }
        } catch (error) {
            console.error("保存失败:", error);
        }
    }
}

const fetchDiscountTiers = () => {
    return async dispatch => {
        try {
            const res = await API.get('/api/option/getDiscountTiers');
            const { success, message, data } = res.data;
            if (success) {
                dispatch(setDiscountTiers({ discountTiers: data }));
            }
        } catch (error) {
            console.error("获取折扣层级失败:", error);
        }
    }
}

export {fetchProviders,setProviders,updateProviders,fetchAdvantages,setAdvantages,
    updateAdvantages,setPriceRatio,setSystemName,setTypingList,updateTypingList,fetchTypingList,
    updateModelDiscriptions,fetchModelDiscriptions,fetchCustemNavLinks,updateCustemNavLinks,
    fetchDiscountTiers,updateDiscountTiers,setDiscountTiers
    };

const reducer = providerStore.reducer;

export default reducer
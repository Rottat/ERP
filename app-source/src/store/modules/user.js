// src/store/modules/user.js
import { getUserList, addUser, updateUser, deleteUser, getUserInfo } from '@/api/user'

export default {
  namespaced: true,
  state: {
    list: [],      // 用户列表数据
    total: 0,      // 总记录数
    loading: false, // 加载状态
    userInfo: null  // 当前登录用户信息
  },
  mutations: {
    SET_LIST(state, { list, total }) {
      state.list = list
      state.total = total
    },
    SET_LOADING(state, loading) {
      state.loading = loading
    },
    SET_USER(state, info) {
      state.userInfo = info
    }
  },
  actions: {
    // 获取用户列表（支持分页和关键词搜索）
    async fetchUsers({ commit }, params = {}) {
      commit('SET_LOADING', true)
      try {
        const res = await getUserList(params)
        // 假设接口返回格式为 { code: 200, data: { list, total } }
        commit('SET_LIST', { list: res.data.list, total: res.data.total })
      } catch (error) {
        console.error('获取用户列表失败', error)
      } finally {
        commit('SET_LOADING', false)
      }
    },
    // 新增用户
    async addUser({ dispatch }, data) {
      await addUser(data)
      // 新增后回到第一页并刷新列表（也可以保持当前页，但为了简单统一回到第一页）
      dispatch('fetchUsers', { page: 1, pageSize: 10, keyword: '' })
    },
    // 更新用户
    async updateUser({ dispatch }, { id, data }) {
      await updateUser(id, data)
      dispatch('fetchUsers') // 刷新当前页列表
    },
    // 删除用户
    async deleteUser({ dispatch }, id) {
      await deleteUser(id)
      dispatch('fetchUsers') // 刷新列表
    },
    // 获取当前登录用户信息
    async fetchUserInfo({ commit }) {
      try {
        const res = await getUserInfo()
        commit('SET_USER', res.data)
      } catch (error) {
        console.error('获取用户信息失败', error)
      }
    }
  }
}
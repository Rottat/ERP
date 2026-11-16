import Mock from 'mockjs'

// ---------- 生成随机产品名称（杯壶罐盒类） ----------
function generateProductName() {
  const categories = [
    { type: '杯', features: ['保温杯', '随手杯', '咖啡杯', '运动水杯', '双层杯', '吸管杯', '啤酒杯', '刻度杯'] },
    { type: '壶', features: ['运动水壶', '户外水壶', '油壶', '喷壶', '长嘴壶', '茶壶', '咖啡壶'] },
    { type: '罐', features: ['密封罐', '储物罐', '奶粉罐', '糖果罐', '茶叶罐', '调味罐', '防潮罐'] },
    { type: '盒', features: ['保鲜盒', '饭盒', '分格盒', '收纳盒', '便当盒', '密封盒', '冰箱收纳盒'] }
  ]
  const materials = ['PP', 'Tritan', 'PPSU', 'ABS', 'PC', 'PET', 'HDPE', 'PS', 'SAN']
  const capacities = ['150ml', '200ml', '350ml', '500ml', '750ml', '1L', '1.2L', '1.5L', '2L', '2.5L', '3L', '5L']
  const colors = ['透明', '白色', '黑色', '蓝色', '绿色', '粉色', '磨砂', '渐变色']
  
  const category = Mock.Random.pick(categories)
  const feature = Mock.Random.pick(category.features)
  const capacity = Mock.Random.pick(capacities)
  const material = Mock.Random.pick(materials)
  const color = Mock.Random.pick(colors)
  return `${capacity}${feature}${category.type}（${material}）${color}`
}

// ---------- 数据存储 ----------
let productList = []       // 商品主数据：{ id, name, price, stock (动态计算，不直接存储) }
let inventoryList = []    // 库存记录：{ id, productId, productName, sku, quantity, warehouse, threshold }
let nextProductId = 1
let nextInventoryId = 1

// 辅助函数：重新计算某个商品的总库存
function recalcProductStock(productId) {
  const total = inventoryList
    .filter(item => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0)
  // 更新 productList 中对应商品的 stock 字段（直接修改对象）
  const product = productList.find(p => p.id === productId)
  if (product) product.stock = total
  return total
}

// 辅助函数：为指定商品生成库存记录（1~2 条，分配总数量）
function generateInventoryForProduct(product) {
  const warehouses = ['A区-01货架', 'A区-02货架', 'B区-01货架', 'B区-02货架', 'C区-01货架', 'C区-02货架', 'D区-01货架']
  const recordCount = Mock.Random.integer(1, 2)
  const totalStock = product.stock   // 商品的总库存（已随机生成）
  let remaining = totalStock
  for (let i = 0; i < recordCount; i++) {
    let quantity
    if (i === recordCount - 1) {
      quantity = remaining   // 最后一条分剩余全部
    } else {
      quantity = Mock.Random.integer(0, remaining)
      remaining -= quantity
    }
    const warehouse = Mock.Random.pick(warehouses)
    const threshold = Mock.Random.integer(5, 50)
    inventoryList.push({
      id: nextInventoryId++,
      productId: product.id,
      productName: product.name,
      sku: `SKU-${String(product.id).padStart(4, '0')}`,
      quantity: quantity,
      warehouse: warehouse,
      threshold: threshold
    })
  }
}

// ---------- 初始化数据：生成 50 个商品，每个商品附带 1~2 条库存记录 ----------
function initData() {
  productList = []
  inventoryList = []
  nextProductId = 1
  nextInventoryId = 1

  const productCount = Mock.Random.integer(40, 80)
  for (let i = 1; i <= productCount; i++) {
    const product = {
      id: i,
      name: generateProductName(),
      price: parseFloat(Mock.Random.float(8, 380, 0, 2).toFixed(2)),
      stock: Mock.Random.integer(0, 3000)   // 先随机总库存
    }
    productList.push(product)
    // 根据总库存生成库存记录
    generateInventoryForProduct(product)
  }
  // 最后确保所有商品的 stock 与库存记录一致（其实上面生成时已经保证，但再校验一次）
  productList.forEach(p => recalcProductStock(p.id))
}

initData()   // 模块加载时执行一次

// ---------- 商品接口 Mock（保持总库存由库存记录动态决定） ----------
Mock.mock(/\/api\/products(\?.*)?/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || 1)
  const pageSize = parseInt(url.searchParams.get('pageSize') || 10)
  const keyword = url.searchParams.get('keyword') || ''
  let filtered = productList.filter(p => !keyword || p.name.includes(keyword))
  // 重新计算每个商品的 stock（确保最新）
  filtered.forEach(p => recalcProductStock(p.id))
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageData = filtered.slice(start, end).map(p => ({ ...p }))  // 浅拷贝
  return {
    code: 200,
    data: { list: pageData, total: filtered.length }
  }
})

Mock.mock('/api/products', 'post', (options) => {
  const body = JSON.parse(options.body)
  const newProduct = {
    id: nextProductId++,
    name: body.name || generateProductName(),
    price: body.price,
    stock: body.stock || 0
  }
  productList.push(newProduct)
  // 为新商品生成库存记录（即使 stock 为 0 也要生成一条空记录？可选）
  generateInventoryForProduct(newProduct)
  recalcProductStock(newProduct.id)
  return { code: 200, data: { ...newProduct } }
})

Mock.mock(/\/api\/products\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.match(/\/api\/products\/(\d+)/)[1])
  const body = JSON.parse(options.body)
  const product = productList.find(p => p.id === id)
  if (!product) return { code: 404, message: '商品不存在' }
  // 注意：修改商品名称、价格等，不直接修改 stock（stock 由库存决定）
  if (body.name) product.name = body.name
  if (body.price !== undefined) product.price = body.price
  // 如果 body 中包含了 stock，忽略它（禁止直接修改总库存）
  recalcProductStock(id)
  return { code: 200, data: { ...product } }
})

Mock.mock(/\/api\/products\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.match(/\/api\/products\/(\d+)/)[1])
  const index = productList.findIndex(p => p.id === id)
  if (index === -1) return { code: 404, message: '商品不存在' }
  productList.splice(index, 1)
  // 同时删除该商品的所有库存记录
  inventoryList = inventoryList.filter(item => item.productId !== id)
  return { code: 200, message: '删除成功' }
})

// ---------- 库存接口 Mock（操作时自动同步商品总库存） ----------
Mock.mock(/\/api\/inventory(\?.*)?/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || 1)
  const pageSize = parseInt(url.searchParams.get('pageSize') || 10)
  const productName = url.searchParams.get('productName') || ''
  const sku = url.searchParams.get('sku') || ''
  const warehouse = url.searchParams.get('warehouse') || ''
  const warningFilter = url.searchParams.get('warningFilter') || ''

  let filtered = inventoryList.filter(item => {
    if (productName && !item.productName.includes(productName)) return false
    if (sku && !item.sku.includes(sku)) return false
    if (warehouse && !item.warehouse.includes(warehouse)) return false
    if (warningFilter === 'below' && !(item.quantity <= item.threshold)) return false
    if (warningFilter === 'normal' && !(item.quantity > item.threshold)) return false
    return true
  })
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageData = filtered.slice(start, end)
  return {
    code: 200,
    data: { list: pageData, total: filtered.length }
  }
})

Mock.mock('/api/inventory', 'post', (options) => {
  const body = JSON.parse(options.body)
  // 确保 productId 存在（前端应传入）
  const product = productList.find(p => p.id === body.productId)
  if (!product) return { code: 400, message: '商品不存在，无法添加入库记录' }
  const newInventory = {
    id: nextInventoryId++,
    productId: body.productId,
    productName: product.name,
    sku: body.sku || `SKU-${String(product.id).padStart(4, '0')}`,
    quantity: body.quantity,
    warehouse: body.warehouse,
    threshold: body.threshold
  }
  inventoryList.push(newInventory)
  recalcProductStock(product.id)   // 同步更新商品总库存
  return { code: 200, data: newInventory }
})

Mock.mock(/\/api\/inventory\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.match(/\/api\/inventory\/(\d+)/)[1])
  const body = JSON.parse(options.body)
  const inv = inventoryList.find(i => i.id === id)
  if (!inv) return { code: 404, message: '库存记录不存在' }
  // 更新字段
  Object.assign(inv, body)
  recalcProductStock(inv.productId)
  return { code: 200, data: inv }
})

Mock.mock(/\/api\/inventory\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.match(/\/api\/inventory\/(\d+)/)[1])
  const index = inventoryList.findIndex(i => i.id === id)
  if (index === -1) return { code: 404, message: '库存记录不存在' }
  const productId = inventoryList[index].productId
  inventoryList.splice(index, 1)
  recalcProductStock(productId)
  return { code: 200, message: '删除成功' }
})

// 用户列表
const userCount = Mock.Random.integer(20, 60)
let userList = []
for (let i = 1; i <= userCount; i++) {
  userList.push({
    id: i,
    username: Mock.Random.name(),
    realName: Mock.Random.cname(),
    role: Mock.Random.pick(['admin', 'user']),
    email: Mock.Random.email(),
    phone: Mock.Random.string('number', 11)
  })
}

Mock.mock(/\/api\/users(\?.*)?/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || 1)
  const pageSize = parseInt(url.searchParams.get('pageSize') || 10)
  const keyword = url.searchParams.get('keyword') || ''
  let filtered = userList
  if (keyword) {
    filtered = userList.filter(item => 
      item.username.includes(keyword) || item.realName.includes(keyword)
    )
  }
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageData = filtered.slice(start, end)
  return {
    code: 200,
    data: {
      list: pageData,
      total: filtered.length
    }
  }
})

Mock.mock('/api/users', 'post', (options) => {
  const body = JSON.parse(options.body)
  const newUser = {
    id: userList.length + 1,
    ...body
  }
  userList.push(newUser)
  return { code: 200, data: newUser }
})

Mock.mock(/\/api\/users\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.match(/\/api\/users\/(\d+)/)[1])
  const body = JSON.parse(options.body)
  const index = userList.findIndex(u => u.id === id)
  if (index !== -1) {
    userList[index] = { ...userList[index], ...body }
    return { code: 200, data: userList[index] }
  }
  return { code: 404, message: '用户不存在' }
})

Mock.mock(/\/api\/users\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.match(/\/api\/users\/(\d+)/)[1])
  const index = userList.findIndex(u => u.id === id)
  if (index !== -1) {
    userList.splice(index, 1)
    return { code: 200, message: '删除成功' }
  }
  return { code: 404, message: '用户不存在' }
})

// 获取当前登录用户信息
Mock.mock('/api/user/info', 'get', () => {
  return {
    code: 200,
    data: {
      id: 1,
      username: 'admin',
      realName: '管理员',
      role: 'admin',
      email: 'admin@example.com',
      phone: '13800138000'
    }
  }
})

const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '重庆', '苏州', '天津', '长沙', '郑州', '东莞']
const industries = ['科技', '信息', '网络', '软件', '贸易', '咨询', '实业', '文化传媒', '广告', '金融', '投资', '医疗', '教育', '物流', '建筑']
const suffixes = ['有限公司', '股份有限公司', '集团', '有限责任公司', '科技有限公司', '信息技术有限公司']

// ================= 客户数据 Mock =================
// 生成随机客户列表（与 customer.js 生成规则一致）
const customerCount = Mock.Random.integer(20, 60)
let globalCustomerList = []
for (let i = 1; i <= customerCount; i++) {
  globalCustomerList.push({
    id: i,
    name: generateCompanyName(),   // 复用前面的公司名生成函数
    contact: Mock.Random.cname(),
    phone: Mock.Random.string('number', 11),
    email: Mock.Random.email(),
    address: Mock.Random.county(true) + ' ',
    createTime: Mock.Random.datetime('yyyy-MM-dd HH:mm:ss'),
    status: Mock.Random.pick(['active', 'inactive'])
  })
}

// 客户列表 API
Mock.mock(/\/api\/customers(\?.*)?/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || 1)
  const pageSize = parseInt(url.searchParams.get('pageSize') || 10)
  const keyword = url.searchParams.get('keyword') || ''
  let filtered = globalCustomerList
  if (keyword) {
    filtered = globalCustomerList.filter(c => c.name.includes(keyword) || c.contact.includes(keyword))
  }
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageData = filtered.slice(start, end)
  return { code: 200, data: { list: pageData, total: filtered.length } }
})

Mock.mock('/api/customers', 'post', (options) => {
  const body = JSON.parse(options.body)
  const newId = globalCustomerList.length + 1
  const newCustomer = { id: newId, ...body, createTime: new Date().toLocaleString('zh-CN') }
  globalCustomerList.push(newCustomer)
  return { code: 200, data: newCustomer }
})

Mock.mock(/\/api\/customers\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.match(/\/api\/customers\/(\d+)/)[1])
  const body = JSON.parse(options.body)
  const index = globalCustomerList.findIndex(c => c.id === id)
  if (index !== -1) {
    globalCustomerList[index] = { ...globalCustomerList[index], ...body }
    return { code: 200, data: globalCustomerList[index] }
  }
  return { code: 404, message: '客户不存在' }
})

Mock.mock(/\/api\/customers\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.match(/\/api\/customers\/(\d+)/)[1])
  const index = globalCustomerList.findIndex(c => c.id === id)
  if (index !== -1) {
    globalCustomerList.splice(index, 1)
    return { code: 200, message: '删除成功' }
  }
  return { code: 404, message: '客户不存在' }
})

function generateCompanyName() {
  const city = Mock.Random.pick(cities)
  const industry = Mock.Random.pick(industries)
  if (Mock.Random.boolean(30)) {
    return industry + Mock.Random.pick(suffixes)
  }
  return city + industry + Mock.Random.pick(suffixes)
}

let orderList = []        // 订单主表
let orderItemList = []    // 订单明细
let nextOrderId = 1
let nextOrderItemId = 1

// 辅助函数：根据订单明细计算总金额
function calcOrderTotal(items) {
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
}

// 辅助函数：获取订单的所有明细
function getOrderItems(orderId) {
  return orderItemList.filter(item => item.orderId === orderId)
}

// 辅助函数：更新订单总金额
function updateOrderTotal(orderId) {
  const order = orderList.find(o => o.id === orderId)
  if (order) {
    const items = getOrderItems(orderId)
    order.totalAmount = calcOrderTotal(items)
  }
}

// 辅助函数：根据订单明细扣减或恢复库存（direction: 'deduct' 或 'restore'）
function adjustInventoryByOrder(orderId, direction) {
  const items = getOrderItems(orderId)
  items.forEach(item => {
    // 查找该商品的库存记录（选择第一个仓库，实际业务需指定，这里简化）
    let inventoryRec = inventoryList.find(inv => inv.productId === item.productId)
    if (!inventoryRec) return
    if (direction === 'deduct') {
      const newQty = Math.max(0, inventoryRec.quantity - item.quantity)
      inventoryRec.quantity = newQty
    } else if (direction === 'restore') {
      inventoryRec.quantity += item.quantity
    }
    // 同步更新商品总库存
    recalcProductStock(item.productId)
  })
}

// 辅助函数：随机生成订单明细（基于当前商品列表，随机选取1~3个不同商品）
function generateOrderItems(orderId) {
  const itemCount = Mock.Random.integer(1, 3)
  // 随机打乱商品列表
  const shuffled = [...productList]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const selectedProducts = shuffled.slice(0, Math.min(itemCount, shuffled.length))
  const items = []
  selectedProducts.forEach(product => {
    const quantity = Mock.Random.integer(1, 10)
    const unitPrice = product.price
    items.push({
      id: nextOrderItemId++,
      orderId: orderId,
      productId: product.id,
      productName: product.name,
      quantity: quantity,
      unitPrice: unitPrice,
      subtotal: quantity * unitPrice
    })
  })
  return items
}

// 初始化订单数据（生成 30 个随机订单，每个订单包含明细，根据状态扣减相应库存）
function initOrders() {
  orderList = []
  orderItemList = []
  nextOrderId = 1
  nextOrderItemId = 1
  
  const statusFlow = ['pending', 'paid', 'shipped', 'completed', 'cancelled']
  const orderCount = Mock.Random.integer(20, 60)
  for (let i = 1; i <= orderCount; i++) {
    const randomCustomer = Mock.Random.pick(globalCustomerList)
    // const customerName = generateCompanyName()
    const status = Mock.Random.pick(statusFlow)
    const daysAgo = Mock.Random.integer(0, 30)
const createTime = new Date()
createTime.setDate(createTime.getDate() - daysAgo)
const createTimeStr = createTime.toISOString().slice(0, 19).replace('T', ' ')
    const order = {
      id: nextOrderId++,
      orderNo: `ORD${Mock.Random.date('yyyyMMdd')}${Mock.Random.string('number', 4)}`,
      customerName: randomCustomer.name,
      status: status,
      totalAmount: 0,
      createTime: createTimeStr,
      customerId: randomCustomer.id,
    }
    orderList.push(order)
    // 生成明细
    const items = generateOrderItems(order.id)
    orderItemList.push(...items)
    updateOrderTotal(order.id)
    // 如果订单状态是 paid / shipped / completed，扣减库存（模拟已付款历史订单）
    if (status === 'paid' || status === 'shipped' || status === 'completed') {
      adjustInventoryByOrder(order.id, 'deduct')
    }
  }
}

// 调用初始化（确保 productList 已存在）
initOrders()

// ---------- 订单接口 Mock ----------
Mock.mock(/\/api\/orders(\?.*)?/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || 1)
  const pageSize = parseInt(url.searchParams.get('pageSize') || 10)
  const orderNo = url.searchParams.get('orderNo') || ''
  const customerName = url.searchParams.get('customerName') || ''
  const status = url.searchParams.get('status') || ''

  let filtered = orderList.filter(order => {
    if (orderNo && !order.orderNo.includes(orderNo)) return false
    if (customerName && !order.customerName.includes(customerName)) return false
    if (status && order.status !== status) return false
    return true
  })
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageData = filtered.slice(start, end).map(order => ({
    ...order,
    items: getOrderItems(order.id)
  }))
  return { code: 200, data: { list: pageData, total: filtered.length } }
})

Mock.mock('/api/orders', 'post', (options) => {
  const body = JSON.parse(options.body)
  const { customerName, items } = body
  const newOrder = {
    id: nextOrderId++,
    orderNo: `ORD${Mock.Random.date('yyyyMMdd')}${Mock.Random.string('number', 4)}`,
    customerName: customerName,
    status: 'pending',
    totalAmount: 0,
    createTime: new Date().toLocaleString('zh-CN')
  }
  orderList.push(newOrder)
  const orderItems = items.map(item => ({
    id: nextOrderItemId++,
    orderId: newOrder.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.quantity * item.unitPrice
  }))
  orderItemList.push(...orderItems)
  updateOrderTotal(newOrder.id)
  return { code: 200, data: { ...newOrder, items: orderItems } }
})

Mock.mock(/\/api\/orders\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.match(/\/api\/orders\/(\d+)/)[1])
  const body = JSON.parse(options.body)
  const order = orderList.find(o => o.id === id)
  if (!order) return { code: 404, message: '订单不存在' }
  if (body.customerName) order.customerName = body.customerName
  // 如需修改明细，此处可扩展，但一般业务不允许直接修改已生成订单的明细
  return { code: 200, data: order }
})

Mock.mock(/\/api\/orders\/\d+\/status/, 'patch', (options) => {
  const id = parseInt(options.url.match(/\/api\/orders\/(\d+)/)[1])
  const { status } = JSON.parse(options.body)
  const order = orderList.find(o => o.id === id)
  if (!order) return { code: 404, message: '订单不存在' }
  const oldStatus = order.status
  if (oldStatus === status) return { code: 200, data: order }
  // 状态迁移规则
  if (oldStatus === 'pending' && status === 'paid') {
    adjustInventoryByOrder(id, 'deduct')
  } else if (oldStatus === 'paid' && status === 'cancelled') {
    adjustInventoryByOrder(id, 'restore')
  }
  order.status = status
  return { code: 200, data: order }
})

Mock.mock(/\/api\/orders\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.match(/\/api\/orders\/(\d+)/)[1])
  const orderIndex = orderList.findIndex(o => o.id === id)
  if (orderIndex === -1) return { code: 404, message: '订单不存在' }
  const order = orderList[orderIndex]
  if (['paid', 'shipped', 'completed'].includes(order.status)) {
    adjustInventoryByOrder(id, 'restore')
  }
  orderItemList = orderItemList.filter(item => item.orderId !== id)
  orderList.splice(orderIndex, 1)
  return { code: 200, message: '删除成功' }
})
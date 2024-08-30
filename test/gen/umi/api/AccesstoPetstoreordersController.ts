// @ts-ignore
/* eslint-disable */
import request from 'umi';

/**
 * Returns pet inventories by status Returns a map of status codes to quantities
 * HTTP Method: GET
 * URL: /store/inventory
 */
export async function getInventory(
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<Record<string, any>>('/store/inventory', {
    method: 'GET',
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Place an order for a pet
 * HTTP Method: POST
 * URL: /store/order
 */
export async function placeOrder( // 请求体参数
  body: API.Order,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<API.Order>('/store/order', {
    method: 'POST',
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Find purchase order by ID For valid response try integer IDs with value >= 1 and <= 10.         Other values will generated exceptions
 * HTTP Method: GET
 * URL: /store/order/${param0}
 */
export async function getOrderById(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getOrderByIdParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { orderId: param0, ...queryParams } = params;
  // 发送请求
  return request<API.Order>(`/store/order/${param0}`, {
    method: 'GET',
    // 设置查询参数
    params: { ...queryParams },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Delete purchase order by ID For valid response try integer IDs with positive integer value.         Negative or non-integer values will generate API errors
 * HTTP Method: DELETE
 * URL: /store/order/${param0}
 */
export async function deleteOrder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteOrderParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { orderId: param0, ...queryParams } = params;
  // 发送请求
  return request<any>(`/store/order/${param0}`, {
    method: 'DELETE',
    // 设置查询参数
    params: { ...queryParams },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

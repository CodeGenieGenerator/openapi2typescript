// @ts-ignore
/* eslint-disable */
import request from 'umi';

/**
 * Create user This can only be done by the logged in user. 返回值: successful operation
 * HTTP Method: POST
 * URL: /user
 */
export async function createUser( // 请求体参数
  body: API.User,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<any>('/user', {
    method: 'POST',
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Get user by user name
 * HTTP Method: GET
 * URL: /user/${param0}
 */
export async function getUserByName(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserByNameParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { username: param0, ...queryParams } = params;
  // 发送请求
  return request<API.User>(`/user/${param0}`, {
    method: 'GET',
    // 设置查询参数
    params: { ...queryParams },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Updated user This can only be done by the logged in user.
 * HTTP Method: PUT
 * URL: /user/${param0}
 */
export async function updateUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateUserParams, // 请求体参数
  body: API.User,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { username: param0, ...queryParams } = params;
  // 发送请求
  return request<any>(`/user/${param0}`, {
    method: 'PUT',
    // 设置查询参数
    params: { ...queryParams },
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Delete user This can only be done by the logged in user.
 * HTTP Method: DELETE
 * URL: /user/${param0}
 */
export async function deleteUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteUserParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { username: param0, ...queryParams } = params;
  // 发送请求
  return request<any>(`/user/${param0}`, {
    method: 'DELETE',
    // 设置查询参数
    params: { ...queryParams },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Creates list of users with given input array 返回值: successful operation
 * HTTP Method: POST
 * URL: /user/createWithArray
 */
export async function createUsersWithArrayInput( // 请求体参数
  body: API.User[],
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<any>('/user/createWithArray', {
    method: 'POST',
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Creates list of users with given input array 返回值: successful operation
 * HTTP Method: POST
 * URL: /user/createWithList
 */
export async function createUsersWithListInput( // 请求体参数
  body: API.User[],
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<any>('/user/createWithList', {
    method: 'POST',
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Logs user into the system
 * HTTP Method: GET
 * URL: /user/login
 */
export async function loginUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.loginUserParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<string>('/user/login', {
    method: 'GET',
    // 设置查询参数
    params: {
      ...params,
    },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Logs out current logged in user session 返回值: successful operation
 * HTTP Method: GET
 * URL: /user/logout
 */
export async function logoutUser(
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<any>('/user/logout', {
    method: 'GET',
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

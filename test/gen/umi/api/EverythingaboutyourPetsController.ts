// @ts-ignore
/* eslint-disable */
import request from 'umi';

/**
 * Update an existing pet
 * HTTP Method: PUT
 * URL: /pet
 */
export async function updatePet( // 请求体参数
  body: API.Pet,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<any>('/pet', {
    method: 'PUT',
    // 设置请求头
    headers: {
      'Content-Type': 'application/json',
    },
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Add a new pet to the store
 * HTTP Method: POST
 * URL: /pet
 */
export async function addPet( // 请求体参数
  body: API.Pet,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<any>('/pet', {
    method: 'POST',
    // 设置请求头
    headers: {
      'Content-Type': 'application/json',
    },
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Find pet by ID Returns a single pet
 * HTTP Method: GET
 * URL: /pet/${param0}
 */
export async function getPetById(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPetByIdParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { petId: param0, ...queryParams } = params;
  // 发送请求
  return request<API.Pet>(`/pet/${param0}`, {
    method: 'GET',
    // 设置查询参数
    params: { ...queryParams },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Updates a pet in the store with form data
 * HTTP Method: POST
 * URL: /pet/${param0}
 */
export async function updatePetWithForm(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updatePetWithFormParams, // 请求体参数
  body: { name?: string; status?: string },
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { petId: param0, ...queryParams } = params;
  // 发送请求
  return request<any>(`/pet/${param0}`, {
    method: 'POST',
    // 设置请求头
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // 设置查询参数
    params: { ...queryParams },
    // 设置请求体数据
    data: body,
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Deletes a pet
 * HTTP Method: DELETE
 * URL: /pet/${param0}
 */
export async function deletePet(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePetParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { petId: param0, ...queryParams } = params;
  // 发送请求
  return request<any>(`/pet/${param0}`, {
    method: 'DELETE',
    // 设置查询参数
    params: { ...queryParams },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * uploads an image
 * HTTP Method: POST
 * URL: /pet/${param0}/uploadImage
 */
export async function uploadFile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.uploadFileParams, // 请求体参数
  body: { additionalMetadata?: string; file?: string }, // 文件上传参数
  file?: File,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 解构路径参数
  const { petId: param0, ...queryParams } = params;
  // 创建 FormData 对象用于文件上传
  const formData = new FormData();

  // 处理文件上传
  if (file) {
    formData.append('file', file);
  }

  // 将 body 参数添加到 FormData
  Object.keys(body).forEach((ele) => {
    const item = (body as any)[ele];

    if (item !== undefined && item !== null) {
      if (typeof item === 'object' && !(item instanceof File)) {
        if (item instanceof Array) {
          item.forEach((f) => formData.append(ele, f || ''));
        } else {
          formData.append(ele, JSON.stringify(item));
        }
      } else {
        formData.append(ele, item);
      }
    }
  });

  // 发送请求
  return request<API.ApiResponse>(`/pet/${param0}/uploadImage`, {
    method: 'POST',
    // 设置查询参数
    params: { ...queryParams },
    // 设置表单数据
    data: formData,

    requestType: 'form',
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

/**
 * Finds Pets by status Multiple status values can be provided with comma separated strings
 * HTTP Method: GET
 * URL: /pet/findByStatus
 */
export async function findPetsByStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.findPetsByStatusParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<API.Pet[]>('/pet/findByStatus', {
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
 * Finds Pets by tags Muliple tags can be provided with comma separated strings. Use         tag1, tag2, tag3 for testing.
 * HTTP Method: GET
 * URL: /pet/findByTags
 */
export async function findPetsByTags(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.findPetsByTagsParams,
  // 请求配置选项
  options?: { [key: string]: any },
) {
  // 发送请求
  return request<API.Pet[]>('/pet/findByTags', {
    method: 'GET',
    // 设置查询参数
    params: {
      ...params,
    },
    // 合并用户传入的配置选项
    ...(options || {}),
  });
}

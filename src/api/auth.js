import client from './client'

export async function login(email, password) {
  const { data } = await client.post('/v1/users/login', { email, password })
  return data.data // { accessToken, tokenType, expiresAt, user }
}

export async function getMe() {
  const { data } = await client.get('/v1/users/me')
  return data // { id, email, role, status }
}

export async function logout() {
  await client.post('/v1/users/logout')
}

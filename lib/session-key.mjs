import { ConductorError } from './errors.mjs'

/**
 * The owner key for task isolation. `exec.agent.id` is the DSH SessionId
 * (agent.id === agent.session.id); subagents are separate sessions.
 *
 * There is deliberately no shared "anonymous" bucket: a call without a session
 * cannot see or control any task. Tests inject a fake agent.
 */
export function sessionKeyFor(exec) {
  const id = exec?.agent?.id ?? exec?.agent?.session?.id ?? exec?.agent?.sessionId ?? exec?.session?.id
  if (typeof id !== 'string' || !id) {
    throw new ConductorError('E_AUTH', '无法确定当前会话，下载任务不能签发', {
      hint: '请在一个 Agent 会话中调用 download；不要在没有会话上下文的环境里直接调用。',
    })
  }
  return `s:${id}`
}

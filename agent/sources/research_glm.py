"""Bounded GLM extraction requests for multi-round research."""
import json
import urllib.request
import urllib.error
from agent.sources.glm import GLMClient


class ResearchGLM(GLMClient):
    def complete_json(self, system_prompt, user_prompt):
        payload = {'model': self.model, 'temperature': 0.1,
                   'thinking': {'type': 'disabled'}, 'max_tokens': 6000,
                   'response_format': {'type': 'json_object'},
                   'messages': [{'role': 'system', 'content': system_prompt},
                                {'role': 'user', 'content': user_prompt}]}
        for attempt in range(2):
            try:
                request = urllib.request.Request(self.base_url + '/chat/completions',
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Authorization': 'Bearer ' + self.api_key, 'Content-Type': 'application/json'})
                with urllib.request.urlopen(request, timeout=180) as response:
                    body = json.load(response)
                choice = body['choices'][0]
                if choice.get('finish_reason') == 'length':
                    raise RuntimeError('GLM输出超出长度限制，请缩小研究批次')
                content = choice['message']['content'].strip()
                if content.startswith('```'):
                    content = content.split('\n', 1)[1].rsplit('```', 1)[0]
                result = json.loads(content)
                if not isinstance(result, dict):
                    raise ValueError('Expected JSON object')
                for wrapper in ('answer', 'result', 'data'):
                    if isinstance(result.get(wrapper), dict) and not any(k in result for k in ('companies', 'queries', 'scope')):
                        result = result[wrapper]
                return result
            except urllib.error.HTTPError as exc:
                if exc.code in (401, 402, 403):
                    raise RuntimeError(f'GLM请求被拒绝（HTTP {exc.code}），请检查密钥权限或账户余额') from exc
                if attempt:
                    raise RuntimeError(f'GLM请求失败（HTTP {exc.code}）') from exc
            except (TimeoutError, urllib.error.URLError, ValueError, KeyError) as exc:
                if attempt:
                    raise RuntimeError('GLM网络或JSON解析失败，原始搜索证据已保存') from exc

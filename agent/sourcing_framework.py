"""Deterministic discovery coverage for evidence-led deal sourcing."""

PATHS = (
    ('bom', 'BOM价值量', 'BOM 成本拆解 高价值 零部件 供应商', True),
    ('technology', '技术路线', '技术路线 对比 创业公司 替代方案', True),
    ('bottleneck', '核心瓶颈', '良率 产能 瓶颈 材料 设备 企业', True),
    ('demand', '需求与资本开支', '客户 资本开支 扩产 设备采购 环评', True),
    ('network', '客户供应商网络', '供应商认证 招投标 生态伙伴 企业', True),
    ('capital', '投资与融资记录', '融资 并购 战略投资 基金 投资组合', True),
    ('chain', '产业链', '产业链 材料 零部件 设备 制造 下游 企业', False),
    ('process', '生产工艺', '生产工序 工艺设备 材料 服务商', False),
    ('competition', '竞争格局', '龙头 竞争对手 细分市场 公司', False),
    ('substitution', '替代与升级', '进口替代 技术升级 新产品 企业', False),
    ('talent', '专利与人才', '专利 论文 实验室 成果转化 创业团队', False),
    ('cluster', '产业集群', '展商名单 行业协会 产业园 重点项目', False),
)


def discovery_paths(topic):
    return [{'id': key, 'name': name, 'priority': priority,
             'query': f'{topic} {terms}'} for key, name, terms, priority in PATHS]


def enrich_plan(topic, plan):
    """Keep model suggestions separate from reproducible coverage requirements."""
    result = dict(plan)
    result['framework_version'] = 'deal-sourcing-1'
    result['discovery_paths'] = discovery_paths(topic)
    result['screening'] = {
        'growth': ['市场空间与份额', '收入增长与单位经济性', '增量ROIC', '融资窗口与估值'],
        'buyout': ['正常化EBITDA与FCF', '现金转换率', '经营改善空间', '股权与退出意愿'],
        'policy': '投资吸引力与交易可行性分别评估；缺少证据时标为待判断，不以融资新闻推断当前可交易。',
    }
    result['change_questions'] = ['需求发生了什么变化', '哪种技术正在替代旧路线',
                                  '利润池向哪个环节迁移', '客户认证与产能约束能否验证']
    return result

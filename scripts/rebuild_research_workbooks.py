"""Re-export completed research with current formatting, without API calls."""
import json
from agent.topic_research import RUNS
from agent.research_export import export_mapping
from agent.settings import load_config


def main():
    columns = load_config()['mapping_columns']
    for state_file in RUNS.glob('*/status.json'):
        state = json.loads(state_file.read_text(encoding='utf-8'))
        if state.get('status') != 'completed':
            continue
        root = state_file.parent
        result = json.loads((root/'result.json').read_text(encoding='utf-8'))
        evidence = json.loads((root/'evidence.json').read_text(encoding='utf-8'))
        export_mapping(root/state['filename'], columns, result['primary'], result['review'], evidence)
        print(state['id'], 'exported')


if __name__ == '__main__':
    main()

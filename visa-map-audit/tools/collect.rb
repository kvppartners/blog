#!/usr/bin/env ruby
# Collects the findings of the two audit workflows out of their journals and writes
#   visa-map-audit/findings.json  (every finding, with the verifiers' verdicts attached)
#   visa-map-audit/findings.md    (the same, grouped and readable)
# Re-run it after the workflows finish to pick up the verdicts that were still pending.
require 'json'

BASE = File.expand_path('~/.claude/projects/-Users-tillo-gurufin-Desktop-code-self-kvppartners-blog/9e3eada8-01bc-4c8d-b5b1-1d2cc07e27c8/subagents/workflows')
RUNS = {
  'graph' => 'wf_afb34694-7ce',       # 19 auditors over slices of the visa graph: edges, gating, notes
  'requirements' => 'wf_a12d9bc3-b5b' # 10 researchers: per-visa requirements, F-2/F-5 GNI, discounts, path memory
}

all = []
status = {}
RUNS.each do |name, run|
  path = File.join(BASE, run, 'journal.jsonl')
  unless File.exist?(path)
    status[name] = { 'run' => run, 'journal' => 'missing' }
    next
  end
  entries = File.readlines(path).map { |l| JSON.parse(l) rescue nil }.compact
  labels = {}
  entries.each { |h| labels[h['agentId']] = h['label'] if h['type'] == 'started' }
  results = entries.select { |h| h['type'] == 'result' }

  # label -> findings, and label -> verdicts, keyed by the slice the label names
  findings_by_slice = {}
  verdicts_by_slice = {}
  results.each do |h|
    label = labels[h['agentId']].to_s
    r = h['result']
    next unless r.is_a?(Hash)
    if label =~ /\A(?:audit|research):(.+)\z/ && r['findings']
      findings_by_slice[$1] = { 'findings' => r['findings'], 'notes' => r['notes'] }
    elsif label =~ /\Averify:(.+?):(\d+):(\w+)\z/ && r['verdicts']
      slice, _start, lens = $1, $2, $3
      (verdicts_by_slice[slice] ||= []).concat(r['verdicts'].map { |v| v.merge('lens' => lens) })
    end
  end

  findings_by_slice.each do |slice, data|
    data['findings'].each_with_index do |f, i|
      votes = (verdicts_by_slice[slice] || []).select { |v| v['index'] == i }
      refuted = votes.count { |v| v['refuted'] }
      all << f.merge(
        'workflow' => name, 'slice' => slice, 'index' => i,
        'votes' => votes.size, 'refuted_by' => refuted,
        'survives' => votes.empty? ? nil : refuted < votes.size,
        'verdicts' => votes.map { |v| v.reject { |k, _| k == 'index' } }
      )
    end
  end

  status[name] = {
    'run' => run,
    'spawned' => entries.count { |h| h['type'] == 'started' },
    'finders_done' => findings_by_slice.size,
    'verifier_results' => verdicts_by_slice.values.sum(&:size),
    'slices' => findings_by_slice.map { |s, d| { 'slice' => s, 'findings' => d['findings'].size,
                                                 'verified' => (verdicts_by_slice[s] || []).map { |v| v['index'] }.uniq.size,
                                                 'notes' => d['notes'] } }
  }
end

out = { 'generated' => Time.now.utc.strftime('%Y-%m-%dT%H:%M:%SZ'), 'status' => status, 'findings' => all }
File.write('visa-map-audit/findings.json', JSON.pretty_generate(out))

SEV = { 'high' => 0, 'medium' => 1, 'low' => 2 }
state = ->(f) {
  return 'UNVERIFIED' if f['survives'].nil?
  f['survives'] ? "SURVIVED #{f['votes'] - f['refuted_by']}/#{f['votes']}" : "REFUTED #{f['refuted_by']}/#{f['votes']}"
}

md = []
md << '# Visa map audit: findings'
md << ''
md << "Generated #{out['generated']} by `visa-map-audit/tools/collect.rb`. Re-run it to refresh."
md << ''
status.each do |name, s|
  md << "- **#{name}** (`#{s['run']}`): #{s['finders_done']} auditors reported, #{s['verifier_results']} verifier verdicts in."
end
md << ''
md << 'Each finding was raised by one auditor and then judged by two independent verifiers with'
md << 'different lenses (a skeptic told to refute it, and a source checker told to confirm the'
md << 'numbers against the primary source). `SURVIVED` means at least one verifier did not refute it.'
md << '`UNVERIFIED` means the verifiers had not reported yet when this was written - treat those as leads, not facts.'
md << ''
md << '## Counts'
md << ''
md << '| state | high | medium | low | total |'
md << '|---|---|---|---|---|'
['SURVIVED', 'REFUTED', 'UNVERIFIED'].each do |st|
  rows = all.select { |f| state.(f).start_with?(st) }
  next if rows.empty?
  md << "| #{st} | #{rows.count { |f| f['severity'] == 'high' }} | #{rows.count { |f| f['severity'] == 'medium' }} | #{rows.count { |f| f['severity'] == 'low' }} | #{rows.size} |"
end
md << ''
md << '| kind | count |'
md << '|---|---|'
all.group_by { |f| f['kind'] }.sort_by { |_, v| -v.size }.each { |k, v| md << "| #{k} | #{v.size} |" }
md << ''

all.group_by { |f| [f['workflow'], f['slice']] }.sort.each do |(wf, slice), rows|
  md << "## #{wf} / #{slice}"
  md << ''
  rows.sort_by { |f| [SEV[f['severity']] || 9, -(f['confidence'] || 0)] }.each do |f|
    title = f['location'] || "#{f['from']} -> #{f['to']}"
    md << "### [#{f['severity']}] #{f['kind']}: #{title}"
    md << ''
    md << "- **state**: #{state.(f)} (auditor confidence #{f['confidence']})"
    md << "- **claim**: #{f['claim']}"
    md << "- **current**: #{f['current']}" if f['current']
    md << "- **correct**: #{f['correct']}" if f['correct']
    md << "- **evidence**: #{f['evidence']}"
    md << "- **citation**: #{f['citation']}"
    md << "- **fix**: #{f['fix']}"
    f['verdicts'].each do |v|
      md << "- **verdict (#{v['lens']})**: #{v['refuted'] ? 'REFUTED' : 'upheld'} - #{v['reason']}"
      md << "  - corrected claim: #{v['corrected_claim']}" if v['corrected_claim'].to_s != ''
      md << "  - corrected value: #{v['corrected_value']}" if v['corrected_value'].to_s != ''
      md << "  - corrected fix: #{v['corrected_fix']}" if v['corrected_fix'].to_s != ''
      md << "  - citation: #{v['citation']}" if v['citation'].to_s != ''
    end
    md << ''
  end
end
File.write('visa-map-audit/findings.md', md.join("\n"))
puts "findings: #{all.size}"
puts "  survived:   #{all.count { |f| f['survives'] == true }}"
puts "  refuted:    #{all.count { |f| f['survives'] == false }}"
puts "  unverified: #{all.count { |f| f['survives'].nil? }}"

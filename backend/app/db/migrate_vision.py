import sqlite3

conn = sqlite3.connect('modelrouter.db')
c = conn.cursor()

# Ensure column exists
c.execute('PRAGMA table_info(models)')
cols = [col[1] for col in c.fetchall()]
if 'supports_vision' not in cols:
    c.execute('ALTER TABLE models ADD COLUMN supports_vision BOOLEAN DEFAULT 0')
    print('Added supports_vision column to models')

# Update vision models
vision_models = ("'gpt-4o'", "'gpt-4o-mini'", "'gemini-1.5-flash'", "'gemini-1.5-pro'")
c.execute(f"UPDATE models SET supports_vision = 1 WHERE model_name IN ({','.join(vision_models)})")

# Insert mock-flagship if not exists
c.execute("SELECT id FROM providers WHERE name = 'mock'")
row = c.fetchone()
if row:
    mock_p_id = row[0]
    c.execute("SELECT id FROM models WHERE model_name = 'mock-flagship'")
    if not c.fetchone():
        c.execute("""
            INSERT INTO models (
                id, provider_id, provider_name, model_name, max_context_window,
                cost_per_1k_prompt_usd, cost_per_1k_completion_usd, baseline_ttft_p95_ms,
                baseline_itl_p95_ms, baseline_p95_latency_ms, latency_variance_ms,
                code_score, math_score, extraction_score, general_score,
                supports_tools, supports_json, supports_vision, is_active, sample_count, created_at
            ) VALUES (
                'mod_mock_flagship_01', ?, 'mock', 'mock-flagship', 128000,
                0.002000, 0.005000, 100.0, 5.0, 200.0, 25.0,
                0.950, 0.950, 0.980, 0.950,
                1, 1, 1, 1, 200, datetime('now')
            )
        """, (mock_p_id,))
        print("Inserted mock-flagship with vision support.")

conn.commit()

c.execute('SELECT model_name, provider_name, supports_vision FROM models')
for row in c.fetchall():
    print(f"Model: {row[0]:<25} Provider: {row[1]:<10} Vision: {bool(row[2])}")
conn.close()

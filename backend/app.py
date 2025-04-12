from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from transformers import CamembertTokenizer, CamembertForSequenceClassification

app = Flask(__name__)
CORS(app)

# Load model
model = CamembertForSequenceClassification.from_pretrained("model_dir")
tokenizer = CamembertTokenizer.from_pretrained("model_dir")
model.eval()

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    text = data.get("text", "") or ""
    title = data.get("title", "") or ""
    full_input = title + " " + text

    inputs = tokenizer(full_input, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
        prediction = torch.argmax(outputs.logits, dim=1).item()

    return jsonify({
        "prediction": "REAL ✅" if prediction == 0 else "FAKE ❌"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

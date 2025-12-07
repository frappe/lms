import json
from frappe.model.document import Document


class AIKnowledgeChunk(Document):
    def validate(self):
        # Handle embedding field validation - convert list to JSON string for storage
        if self.embedding and isinstance(self.embedding, list):
            # Convert list to JSON string for database storage
            self.embedding = json.dumps(self.embedding)
    
    def get_embedding(self):
        """Get embedding as a list (parse JSON if stored as string)"""
        if not self.embedding:
            return None
        if isinstance(self.embedding, str):
            try:
                return json.loads(self.embedding)
            except json.JSONDecodeError:
                return None
        return self.embedding


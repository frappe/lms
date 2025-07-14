from .base import Resource
from ..constants.url import URL


class Dispute(Resource):
    def __init__(self, client=None):
        super(Dispute, self).__init__(client)
        self.base_url = URL.V1 + URL.DISPUTE

    def fetch(self, dispute_id, data={}, **kwargs):
        """
        Fetch dispute for given Id

        Returns:
            dispute dict for given dispute Id
        """
        return super(Dispute, self).fetch(dispute_id, data, **kwargs)

    def accept(self, dispute_id, data={}, **kwargs):
        """
        Accept a dispute

        Returns:
             Dictionary of disputes
        """
        url = f"{self.base_url}/{dispute_id}/accept"
        return self.post_url(url, data, **kwargs)

    def contest(self, dispute_id, data={}, **kwargs):
        """
        Contest a Dispute

        Returns:
             Dictionary of disputes
        """
        url = f"{self.base_url}/{dispute_id}/contest"
        return self.patch_url(url, data, **kwargs)

    def all(self, data={}, **kwargs):
        """
        Fetch all disputes

        Returns:
            Dictionary of disputes
        """
        return super(Dispute, self).all(data, **kwargs)    

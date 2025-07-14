from .base import Resource
from ..constants.url import URL


class Card(Resource):
    def __init__(self, client=None):
        super(Card, self).__init__(client)
        self.base_url = URL.V1 + URL.CARD_URL

    def fetch(self, card_id, data={}, **kwargs):
        """
        Fetch Card for given Id

        Args:
            card_id : Id for which card object has to be retrieved

        Returns:
            Card dict for given card Id
        """
        return super(Card, self).fetch(card_id, data, **kwargs)

    def requestCardReference(self, data={}, **kwargs):
        """
        Fetch card reference number for a specific card

        Args:
            number : The card number whose PAR or network reference id should be retrieved.

        Returns:
            Card dict for given card Id
        """
        url = "{}/{}".format(self.base_url, "fingerprints")
        return self.post_url(url, data, **kwargs)

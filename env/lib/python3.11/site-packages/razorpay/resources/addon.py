from .base import Resource
from ..constants.url import URL


class Addon(Resource):
    def __init__(self, client=None):
        super(Addon, self).__init__(client)
        self.base_url = URL.V1 + URL.ADDON_URL

    def fetch(self, addon_id, data={}, **kwargs):
        """
        Fetch addon for given Id

        Args:
            addon_id : Id for which addon object has to be retrieved

        Returns:
            addon dict for given subscription Id
        """
        return super(Addon, self).fetch(addon_id, data, **kwargs)

    def delete(self, addon_id, data={}, **kwargs):
        """
        Delete addon for given id

        Args:
            addon_id : Id for which addon object has to be deleted
        """
        url = '{}/{}'.format(self.base_url, addon_id)

        return self.delete_url(url, data, **kwargs)

    def all(self, data={}, **kwargs):
        """
        Fetch all Add-ons
        Returns:
            Dictionary of Add-ons
        """
        return super(Addon, self).all(data, **kwargs)    

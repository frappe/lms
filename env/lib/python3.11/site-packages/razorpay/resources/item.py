from .base import Resource
from ..constants.url import URL


class Item(Resource):
    def __init__(self, client=None):
        super(Item, self).__init__(client)
        self.base_url = URL.V1 + URL.ITEM_URL
    
    def create(self, data={}, **kwargs):
        """
        Create item

        Returns:
            Item Dict which was created
        """
        url = self.base_url
        return self.post_url(url, data, **kwargs)

    def fetch(self, item_id, data={}, **kwargs):
        """
        Fetch an Item

        Args:
            item_id : The id of the item to be fetched

        Returns:
            Item dict for given card Id
        """
        return super(Item, self).fetch(item_id, data, **kwargs)
    
    def all(self, data={}, **kwargs):
        """
        Fetch all items

        Returns:
            Dictionary of Items data
        """
        return super(Item, self).all(data, **kwargs)

    def edit(self, item_id, data={}, **kwargs):
        """
        Update an Item

        Returns:
            Item Dict which was edited
        """
        url = '{}/{}'.format(self.base_url, item_id)

        return self.patch_url(url, data, **kwargs)    
    
    def delete(self, item_id, **kwargs):
        """
        Delete an Item

        Args:
            item_id : The id of the item to be deleted

        Returns:
            The response is always be an empty array like this - []
        """
        url = "{}/{}".format(self.base_url, item_id)
        return self.delete_url(url, {}, **kwargs)
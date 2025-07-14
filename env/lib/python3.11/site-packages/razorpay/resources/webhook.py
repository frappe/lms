from .base import Resource
from ..constants.url import URL


class Webhook(Resource):
    def __init__(self, client=None):
        super(Webhook, self).__init__(client)
        self.base_url = URL.V2 + URL.ACCOUNT

    def create(self, data={}, account_id=None,  **kwargs):
        """
        Create webhook from given dict

        Returns:
            Webhook Dict which was created
        """
        if account_id is None:
          url = '{}{}'.format(URL.V1, URL.WEBHOOK)
        else:
          url = '{}/{}{}'.format(self.base_url, account_id, URL.WEBHOOK)
        
        return self.post_url(url, data, **kwargs)

    def fetch(self, webhook_id, account_id, data={}, **kwargs):
        """
        Fetch webhook for given webhook id

        Args:
            account_id : Id for which webhook object has to be retrieved
            webhook_id : Id for which account object has to be retrieved

        Returns:
            webhook dict for given webhook_id
        """
        if(account_id):
          url = '{}/{}{}/{}'.format(self.base_url, account_id, URL.WEBHOOK, webhook_id)
        else:
          url = '{}{}/{}'.format(URL.V1, URL.WEBHOOK, webhook_id)

        return self.get_url(url, data, **kwargs)

    def all(self, data={}, account_id=None, **kwargs):
        """
        Fetch all webhooks

        Args:
            account_id : Id for which webhook object has to be retrieved

        Returns:
            webhook dict for given account_id
        """
        if account_id is None:
          url = '{}{}'.format(URL.V1, URL.WEBHOOK)    
        else:
          url = '{}/{}{}'.format(self.base_url, account_id, URL.WEBHOOK)

        return self.get_url(url, data, **kwargs)        

    def edit(self, webhook_id, account_id, data={}, **kwargs):
        """
        Edit webhook from given dict

        Returns:
            Webhook Dict which was edited
        """
        if(account_id):
          url = '{}/{}{}/{}'.format(self.base_url, account_id, URL.WEBHOOK, webhook_id)
          return self.patch_url(url, data, **kwargs)

        else:
          url = '{}{}/{}'.format(URL.V1, URL.WEBHOOK, webhook_id)
          return self.put_url(url, data, **kwargs)

    def delete(self, webhook_id, account_id,  data={}, **kwargs):
        """
        delete webhook for given webhook id

        Args:
            account_id : Id for which webhook object has to be retrieved
            webhook_id : Id for which account object has to be retrieved

        Returns:
            The response is always be an empty array like this - []
        """
        url = '{}/{}{}/{}'.format(self.base_url, account_id, URL.WEBHOOK, webhook_id)
        return self.delete_url(url, data, **kwargs)   
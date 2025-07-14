from .base import Resource
from ..constants.url import URL


class Account(Resource):
    def __init__(self, client=None):
        super(Account, self).__init__(client)
        self.base_url = URL.V2 + URL.ACCOUNT

    def create(self, data={}, **kwargs):
        """
        Create account from given dict

        Returns:
            Account Dict which was created
        """
        url = self.base_url
        return self.post_url(url, data, **kwargs)

    def fetch(self, account_id, data={}, **kwargs):
        """
        Fetch account for given Id

        Args:
            account_id : Id for which addon object has to be retrieved

        Returns:
            account dict for given account_id
        """
        return super(Account, self).fetch(account_id, data, **kwargs)

    def edit(self, account_id, data={}, **kwargs):
        """
        Edit account information from given dict

        Returns:
            Account Dict which was edited
        """
        url = '{}/{}'.format(self.base_url, account_id)

        return self.patch_url(url, data, **kwargs)

    def delete(self, account_id, data={}, **kwargs):
        """
        Delete account for given id

        Args:
            account_id : Id for which account object has to be deleted
        """
        url = '{}/{}'.format(self.base_url, account_id)

        return self.delete_url(url, data, **kwargs)

    def uploadAccountDoc(self, account_id, data={}, **kwargs):
        """
        Upload Account Documents

        Returns:
           Account Document dict which was created            
        """
        url = '{}/{}/{}'.format(self.base_url, account_id, "documents")

        return self.file_url(url, data, **kwargs)

    def fetchAccountDoc(self, account_id, data={}, **kwargs):
        """
        Fetch Account Documents

        Returns:
            Account Document dict for given account_id
        """
        url = '{}/{}/{}'.format(self.base_url, account_id, "documents")

        return self.get_url(url, data, **kwargs)               

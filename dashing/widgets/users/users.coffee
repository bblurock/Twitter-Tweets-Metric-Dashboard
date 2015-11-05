class Dashing.Users extends Dashing.Widget

    ready: ->
        @users = []
        @nextComment()
        @nameChanged()

    onData: (data) ->
        @users = data.data
        $target = $('#screenNames')
        $target.text('');

        @users.map (item) ->
            $target.append("<option value='#{item.name}'>#{item.name}</option>");

        if (localStorage.getItem('selectedName')) then $target.val(localStorage.getItem('selectedName')) else $target.val('tickleapp')
        @nameChanged()

    nameChanged: ->
        console.log @users

        currentUser = @users.filter (user)->
            return ($('#screenNames option:selected').text() == user.name)

        if currentUser.length > 0
            @set "userScreenName",  currentUser[0].name
            @set "userDescription", currentUser[0].description
            @set "userBannerUrl",   currentUser[0].profile_banner_url
            @set "userImageUrl",    currentUser[0].profile_image_url
            @set "userFollowers",   currentUser[0].follower
            @set "userFavorites",   currentUser[0].favorites
            @set "userTweets",      currentUser[0].tweets

        localStorage.setItem('selectedName', currentUser[0].name)

    nextComment: =>
        comments = @get('comments')
        if comments
            @commentElem.fadeOut =>
                @currentIndex = (@currentIndex + 1) % comments.length
                @set 'current_comment', comments[@currentIndex]
                @commentElem.fadeIn()
